import React, { useEffect } from 'react'

const base = import.meta.env.BASE_URL || '/'
const videoSrc = `${base.endsWith('/') ? base : `${base}/`}JobRush.mp4`

/** Ensure native controls show unmuted state; call before programmatic play(). */
export function applyAudiblePlayback(video) {
  if (!video) return
  video.muted = false
  video.defaultMuted = false
  video.volume = 1
}

/**
 * @param {{ layout: 'hero' | 'pip', videoRef: React.RefObject<HTMLVideoElement | null> }} props
 */
export default function HeroDemoVideo({ layout, videoRef }) {
  const isPip = layout === 'pip'

  useEffect(() => {
    applyAudiblePlayback(videoRef.current)
  }, [videoRef, layout])

  return (
    <div
      className={`fixed z-[100] pointer-events-auto transition-[inset,width,height,transform,opacity,box-shadow,border-radius] duration-500 ease-out ${
        isPip
          ? 'bottom-4 right-4 left-auto top-auto w-[min(20rem,calc(100vw-1.5rem))] sm:w-[22rem] rounded-xl overflow-hidden shadow-2xl ring-2 ring-white/50'
          : 'inset-0 flex items-center justify-center px-3 py-6 sm:p-8 bg-slate-900/55 backdrop-blur-[3px]'
      }`}
      role="region"
      aria-label={isPip ? 'Demo video (minimized)' : 'Demo video'}
    >
      <div className={isPip ? 'w-full' : 'w-full max-w-5xl max-h-[min(85vh,56rem)]'}>
        <video
          ref={videoRef}
          src={videoSrc}
          className={`w-full bg-black ${isPip ? 'aspect-video object-cover' : 'max-h-[min(85vh,56rem)] rounded-2xl object-contain shadow-2xl ring-1 ring-white/20'}`}
          playsInline
          autoPlay
          controls
          controlsList="nodownload"
          preload="auto"
        />
      </div>
    </div>
  )
}
