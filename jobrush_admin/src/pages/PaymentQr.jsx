import React, { useState, useEffect } from 'react'
import { QrCodeIcon, ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline'
import {
  getPaymentQrImageUrl,
  setPaymentQrImageUrl,
  clearPaymentQrImageUrl,
} from '../services/adminDb'

const MAX_FILE_BYTES = 350 * 1024

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ''))
    r.onerror = () => reject(new Error('Could not read file.'))
    r.readAsDataURL(file)
  })
}

export default function PaymentQr() {
  const [previewUrl, setPreviewUrl] = useState(null)
  const [savedUrl, setSavedUrl] = useState(null)
  const [urlDraft, setUrlDraft] = useState('')
  const [message, setMessage] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadSaved = async () => {
    setLoading(true)
    setMessage({ type: '', text: '' })
    try {
      const url = await getPaymentQrImageUrl()
      setSavedUrl(url)
      setPreviewUrl(url)
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Could not load payment QR from Firebase.' })
      setSavedUrl(null)
      setPreviewUrl(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSaved()
  }, [])

  /** Writes immediately to Realtime Database — no separate save step. */
  const persistQrToFirebase = async (url) => {
    const toSave = String(url || '').trim()
    if (!toSave) {
      setMessage({ type: 'error', text: 'Nothing to save.' })
      return
    }
    setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      await setPaymentQrImageUrl(toSave)
      setSavedUrl(toSave)
      setPreviewUrl(toSave)
      setMessage({
        type: 'ok',
        text: 'Stored in Firebase Realtime Database. The client payment modal will use this QR on next open.',
      })
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Could not save to Firebase.' })
    } finally {
      setSaving(false)
    }
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please choose an image file (PNG or JPEG recommended).' })
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setMessage({
        type: 'error',
        text: `Image must be under ${Math.floor(MAX_FILE_BYTES / 1024)} KB, or use a hosted image URL below.`,
      })
      return
    }
    setMessage({ type: '', text: '' })
    try {
      const dataUrl = await readFileAsDataUrl(file)
      await persistQrToFirebase(dataUrl)
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Failed to read or save image.' })
      setSaving(false)
    }
  }

  const onSaveUrl = async (e) => {
    e.preventDefault()
    const raw = urlDraft.trim()
    if (!raw) {
      setMessage({ type: 'error', text: 'Paste an https image URL, or upload a file above.' })
      return
    }
    if (!raw.startsWith('https://') && !raw.startsWith('data:image/')) {
      setMessage({ type: 'error', text: 'URL must start with https:// or use an uploaded image.' })
      return
    }
    await persistQrToFirebase(raw)
    setUrlDraft('')
  }

  const clear = async () => {
    if (!window.confirm('Remove the custom QR from Firebase? The client will fall back to env or default image.')) {
      return
    }
    setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      await clearPaymentQrImageUrl()
      setSavedUrl(null)
      setPreviewUrl(null)
      setMessage({
        type: 'ok',
        text: 'Removed from Firebase. Client will use VITE_PAYMENT_QR_URL or the bundled PhonePe QR (payment-phonepe-qr.png).',
      })
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Could not clear.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-white mb-2">Payment management</h1>
      <p className="text-admin-300 text-sm mb-2">
        Upload or set a URL below — each action writes straight to{' '}
        <span className="text-admin-200">Firebase Realtime Database</span> (<code className="text-admin-400 text-xs">adminPortal/paymentQr</code>)
        and persists until you change or remove it.
      </p>
      <p className="text-admin-400 text-xs mb-8">The JobRush client reads this path when users open the payment step.</p>

      <div className="bg-admin-900/80 border border-admin-800 rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-admin-800">
            <QrCodeIcon className="w-6 h-6 text-admin-300" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Payment QR code</h2>
            <p className="text-xs text-admin-400">Saved immediately to Firebase (no extra save button)</p>
          </div>
        </div>

        {loading ? (
          <p className="text-admin-400 text-sm">Loading…</p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="shrink-0 p-3 bg-admin-950 rounded-xl border border-admin-800 min-h-[200px] min-w-[200px] flex items-center justify-center">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Payment QR preview"
                    className="w-[200px] h-[200px] object-contain"
                  />
                ) : (
                  <span className="text-admin-500 text-sm text-center px-2">No QR in Firebase yet</span>
                )}
              </div>
              <div className="flex-1 space-y-4 w-full min-w-0">
                <div>
                  <label className="block text-sm font-medium text-admin-200 mb-2">Upload new QR (PNG/JPEG)</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={onFile}
                    disabled={saving}
                    className="block w-full text-sm text-admin-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-admin-700 file:text-white hover:file:bg-admin-600 disabled:opacity-50"
                  />
                  <p className="text-xs text-admin-500 mt-1">Max {Math.floor(MAX_FILE_BYTES / 1024)} KB. Upload saves to Firebase as soon as the file is read.</p>
                </div>
                <form onSubmit={onSaveUrl} className="space-y-2">
                  <label className="block text-sm font-medium text-admin-200">Or paste image URL (https)</label>
                  <div className="flex gap-2 flex-col sm:flex-row">
                    <input
                      name="qrUrl"
                      type="url"
                      value={urlDraft}
                      onChange={(e) => setUrlDraft(e.target.value)}
                      placeholder="https://…"
                      disabled={saving}
                      className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-admin-950 border border-admin-600 text-white focus:ring-2 focus:ring-admin-500 focus:border-transparent placeholder:text-admin-600 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={saving || !urlDraft.trim()}
                      className="shrink-0 px-4 py-2.5 rounded-xl bg-admin-600 text-white text-sm font-medium hover:bg-admin-500 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save URL to Firebase'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {message.text && (
              <p
                className={`text-sm ${message.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
                role="alert"
              >
                {message.text}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={loadSaved}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-admin-600 text-admin-200 text-sm font-medium hover:bg-admin-800 disabled:opacity-50"
              >
                <ArrowPathIcon className="w-4 h-4" />
                Reload from Firebase
              </button>
              {savedUrl && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={clear}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-red-300 text-sm font-medium hover:bg-admin-800 disabled:opacity-50"
                >
                  <TrashIcon className="w-4 h-4" />
                  Remove from Firebase
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
