/**
 * Stage 5 — Frame-Level Feature Extraction
 * Local video frame analysis using face-api.js
 * Samples frames every 250ms. All processing occurs locally on the client device.
 */

const MODELS_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/'
const SAMPLE_INTERVAL_MS = 250

// face-api expression keys -> Stage 5 format
const EXPRESSION_MAP = {
  neutral: 'neutral',
  happy: 'happy',
  fearful: 'fear',
  surprised: 'surprise',
  angry: 'anger',
  sad: 'sadness',
  disgusted: 'disgust',
}

let modelsLoaded = false

async function loadModels() {
  if (modelsLoaded) return
  const faceapi = await import('face-api.js')
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
    faceapi.nets.faceExpressionNet.loadFromUri(MODELS_URL),
  ])
  modelsLoaded = true
}

function getEyeCenter(eyePoints) {
  if (!eyePoints || eyePoints.length === 0) return null
  const sum = eyePoints.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  return { x: sum.x / eyePoints.length, y: sum.y / eyePoints.length }
}

function getNoseTip(nosePoints) {
  if (!nosePoints || nosePoints.length < 4) return null
  return nosePoints[3]
}

/**
 * Eye Aspect Ratio - drops when eye is closed (blink)
 */
function getEyeAspectRatio(eyePoints) {
  if (!eyePoints || eyePoints.length < 6) return null
  const [p1, p2, p3, p4, p5, p6] = eyePoints
  const vert1 = Math.hypot(p2.x - p6.x, p2.y - p6.y)
  const vert2 = Math.hypot(p3.x - p5.x, p3.y - p5.y)
  const horiz = Math.hypot(p1.x - p4.x, p1.y - p4.y)
  if (horiz < 1e-6) return null
  return (vert1 + vert2) / (2 * horiz)
}

/**
 * Compute head orientation (yaw, pitch, roll) from 68 landmarks
 * Roll: tilt from eye line. Pitch: nose up/down. Yaw: nose left/right.
 */
function computeHeadOrientation(landmarks, frameWidth, frameHeight) {
  if (!landmarks) return { yaw: 0, pitch: 0, roll: 0 }
  try {
    const leftEye = landmarks.getLeftEye()
    const rightEye = landmarks.getRightEye()
    const nose = landmarks.getNose()
    const leftCenter = getEyeCenter(leftEye)
    const rightCenter = getEyeCenter(rightEye)
    const noseTip = getNoseTip(nose)
    if (!leftCenter || !rightCenter || !noseTip) return { yaw: 0, pitch: 0, roll: 0 }

    const eyeMidX = (leftCenter.x + rightCenter.x) / 2
    const eyeMidY = (leftCenter.y + rightCenter.y) / 2
    const eyeDist = Math.hypot(rightCenter.x - leftCenter.x, rightCenter.y - leftCenter.y) || 1

    const roll = Math.atan2(rightCenter.y - leftCenter.y, rightCenter.x - leftCenter.x) * (180 / Math.PI)
    const yaw = ((noseTip.x - eyeMidX) / eyeDist) * 45
    const pitch = ((noseTip.y - eyeMidY) / eyeDist) * 45

    return { yaw, pitch, roll }
  } catch {
    return { yaw: 0, pitch: 0, roll: 0 }
  }
}

/**
 * Extract key landmark positions for facial stability
 */
function getKeyLandmarkPositions(landmarks) {
  if (!landmarks) return []
  try {
    const leftEye = landmarks.getLeftEye()
    const rightEye = landmarks.getRightEye()
    const nose = landmarks.getNose()
    const mouth = landmarks.getMouth()
    const leftC = getEyeCenter(leftEye)
    const rightC = getEyeCenter(rightEye)
    const noseTip = getNoseTip(nose)
    const mouthCenter = mouth && mouth.length ? getEyeCenter(mouth) : null
    const points = [leftC, rightC, noseTip, mouthCenter].filter(Boolean)
    return points.flatMap((p) => [p.x, p.y])
  } catch {
    return []
  }
}

/**
 * Stage 5 frame-level features
 */
function extractFrameFeatures(result, frameWidth, frameHeight) {
  const empty = {
    facePresence: false,
    headOrientation: { yaw: 0, pitch: 0, roll: 0 },
    eyeDirectionProxy: false,
    facialEmotionProbabilities: { neutral: 1, happy: 0, fear: 0, surprise: 0, anger: 0, sadness: 0, disgust: 0 },
    facialStability: 1,
    keyLandmarks: [],
  }

  if (!result) return empty

  const { landmarks, expressions } = result

  const headOrientation = computeHeadOrientation(landmarks, frameWidth, frameHeight)
  const eyeDirectionProxy = Math.abs(headOrientation.yaw) < 15 && Math.abs(headOrientation.pitch) < 15

  const facialEmotionProbabilities = {
    neutral: 0,
    happy: 0,
    fear: 0,
    surprise: 0,
    anger: 0,
    sadness: 0,
    disgust: 0,
  }
  if (expressions) {
    for (const [key, val] of Object.entries(expressions)) {
      const mapped = EXPRESSION_MAP[key]
      if (mapped && mapped in facialEmotionProbabilities) {
        facialEmotionProbabilities[mapped] = val
      }
    }
  }

  const keyLandmarks = getKeyLandmarkPositions(landmarks)

  return {
    facePresence: true,
    headOrientation,
    eyeDirectionProxy,
    facialEmotionProbabilities,
    facialStability: 0,
    keyLandmarks,
  }
}

/**
 * Process video stream and collect metrics
 * @param {HTMLVideoElement} videoElement - Video element with live stream
 * @param {Function} onFrame - Callback with metrics for each sampled frame
 * @returns {Function} - Stop function to cancel processing
 */
export async function startVideoAnalysis(videoElement, onFrame) {
  await loadModels()
  const faceapi = await import('face-api.js')

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,
    scoreThreshold: 0.5,
  })

  const landmarkHistory = []
  const earBlinkThreshold = 0.2
  let blinkCount = 0
  let lastEarLow = false
  const startTime = Date.now()

  const processFrame = async () => {
    if (!videoElement || videoElement.readyState < 2) return
    const w = videoElement.videoWidth || 640
    const h = videoElement.videoHeight || 480
    if (w === 0 || h === 0) return

    try {
      const result = await faceapi
        .detectSingleFace(videoElement, options)
        .withFaceLandmarks()
        .withFaceExpressions()

      const features = extractFrameFeatures(result, w, h)

      if (features.facePresence && features.keyLandmarks.length > 0) {
        landmarkHistory.push(features.keyLandmarks)
        if (landmarkHistory.length > 20) landmarkHistory.shift()
      }

      // Facial stability: inverse of movement variance of key landmarks
      let facialStability = 1
      if (landmarkHistory.length >= 5) {
        const n = landmarkHistory[0].length
        let totalVariance = 0
        for (let i = 0; i < n; i++) {
          const vals = landmarkHistory.map((h) => h[i])
          const mean = vals.reduce((a, b) => a + b, 0) / vals.length
          const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length
          totalVariance += variance
        }
        const avgVariance = totalVariance / n
        facialStability = Math.max(0, 1 - Math.min(1, avgVariance * 100))
      }
      features.facialStability = facialStability

      // Blink detection (EAR)
      let leftEAR = null
      let rightEAR = null
      if (result?.landmarks) {
        try {
          leftEAR = getEyeAspectRatio(result.landmarks.getLeftEye())
          rightEAR = getEyeAspectRatio(result.landmarks.getRightEye())
        } catch {}
      }
      const avgEAR = [leftEAR, rightEAR].filter((x) => x != null)
      const ear = avgEAR.length ? avgEAR.reduce((a, b) => a + b, 0) / avgEAR.length : null
      if (ear !== null) {
        if (ear < earBlinkThreshold && !lastEarLow) {
          blinkCount++
          lastEarLow = true
        } else if (ear >= earBlinkThreshold) {
          lastEarLow = false
        }
      }

      const elapsedSec = (Date.now() - startTime) / 1000 || 0.25
      const blinkFrequency = blinkCount / elapsedSec

      onFrame({
        ...features,
        blinkFrequency,
        timestamp: Date.now(),
      })
    } catch (err) {
      onFrame(extractFrameFeatures(null, w, h))
    }
  }

  const intervalId = setInterval(processFrame, SAMPLE_INTERVAL_MS)
  processFrame()

  return () => clearInterval(intervalId)
}
