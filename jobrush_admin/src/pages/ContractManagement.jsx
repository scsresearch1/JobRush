import React, { useCallback, useEffect, useState } from 'react'
import { PlusCircleIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import {
  listCoupons,
  listContractAccounts,
  createContractAccount,
  updateContractAccount,
  deleteContractAccount,
} from '../services/adminDb'
import { COUPON_FIELDS } from '../config/schema'

function couponLabel(row) {
  const code = row[COUPON_FIELDS.COUPON_CODE] || row.id
  const name = row[COUPON_FIELDS.CONTRACT_NAME] || ''
  return name ? `${code} — ${name}` : code
}

export default function ContractManagement() {
  const [coupons, setCoupons] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [busyId, setBusyId] = useState('')

  const [form, setForm] = useState({
    username: '',
    password: '',
    displayName: '',
    couponCodes: [],
  })
  const [saving, setSaving] = useState(false)

  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({
    password: '',
    displayName: '',
    couponCodes: [],
  })

  const load = useCallback(async () => {
    setLoading(true)
    setMessage({ type: '', text: '' })
    try {
      const [c, a] = await Promise.all([listCoupons(), listContractAccounts()])
      setCoupons(c)
      setAccounts(a)
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Could not load data.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleCouponForCreate = (code) => {
    const c = String(code || '').toUpperCase()
    setForm((prev) => {
      const set = new Set(prev.couponCodes)
      if (set.has(c)) set.delete(c)
      else set.add(c)
      return { ...prev, couponCodes: [...set].sort() }
    })
  }

  const toggleCouponForEdit = (code) => {
    const c = String(code || '').toUpperCase()
    setEditForm((prev) => {
      const set = new Set(prev.couponCodes)
      if (set.has(c)) set.delete(c)
      else set.add(c)
      return { ...prev, couponCodes: [...set].sort() }
    })
  }

  const onCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      await createContractAccount({
        username: form.username,
        password: form.password,
        displayName: form.displayName,
        couponCodes: form.couponCodes,
      })
      setMessage({ type: 'ok', text: 'Contract partner account created. They can sign in at the same URL as admin.' })
      setForm({ username: '', password: '', displayName: '', couponCodes: [] })
      await load()
    } catch (e2) {
      setMessage({ type: 'error', text: e2?.message || 'Could not create account.' })
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (acc) => {
    setEditId(acc.id)
    setEditForm({
      password: '',
      displayName: acc.displayName || acc.username,
      couponCodes: [...acc.couponCodes],
    })
    setMessage({ type: '', text: '' })
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditForm({ password: '', displayName: '', couponCodes: [] })
  }

  const onSaveEdit = async (e) => {
    e.preventDefault()
    if (!editId) return
    setBusyId(editId)
    setMessage({ type: '', text: '' })
    try {
      const patch = {
        displayName: editForm.displayName,
        couponCodes: editForm.couponCodes,
      }
      if (editForm.password.trim()) {
        patch.password = editForm.password
      }
      await updateContractAccount(editId, patch)
      setMessage({ type: 'ok', text: 'Account updated.' })
      cancelEdit()
      await load()
    } catch (e2) {
      setMessage({ type: 'error', text: e2?.message || 'Could not update account.' })
    } finally {
      setBusyId('')
    }
  }

  const onDelete = async (acc) => {
    const ok = window.confirm(
      `Remove contract partner “${acc.username}”? They will no longer be able to sign in.`
    )
    if (!ok) return
    setBusyId(acc.id)
    setMessage({ type: '', text: '' })
    try {
      await deleteContractAccount(acc.id)
      setMessage({ type: 'ok', text: 'Account removed.' })
      if (editId === acc.id) cancelEdit()
      await load()
    } catch (e2) {
      setMessage({ type: 'error', text: e2?.message || 'Could not delete account.' })
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Contract management</h1>
        <p className="text-admin-300 text-sm leading-relaxed max-w-3xl">
          Create logins for external contract partners and assign one or more coupon codes. Partners use the same portal
          URL as you; after sign-in they only see usage statistics for their assigned coupons. Create coupons first
          under <span className="text-admin-200">Coupon management</span>.
        </p>
      </div>

      {message.text && (
        <p
          className={`text-sm rounded-xl px-4 py-3 border ${
            message.type === 'ok'
              ? 'text-emerald-200 border-emerald-800/80 bg-emerald-950/40'
              : 'text-red-300 border-red-900/60 bg-red-950/30'
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="bg-admin-900/80 border border-admin-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <PlusCircleIcon className="w-6 h-6 text-admin-400" />
          New contract partner
        </h2>
        <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-admin-400 mb-1">Username</label>
            <input
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              className="w-full rounded-xl bg-admin-950 border border-admin-600 px-3 py-2 text-white text-sm"
              placeholder="e.g. acme_partner"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-admin-400 mb-1">Password (min 8 characters)</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              className="w-full rounded-xl bg-admin-950 border border-admin-600 px-3 py-2 text-white text-sm"
              autoComplete="new-password"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-admin-400 mb-1">Display name (optional)</label>
            <input
              value={form.displayName}
              onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
              className="w-full rounded-xl bg-admin-950 border border-admin-600 px-3 py-2 text-white text-sm"
              placeholder="Shown after sign-in"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-admin-400 mb-2">Assigned coupons</label>
            {coupons.length === 0 ? (
              <p className="text-admin-500 text-sm">No coupons yet. Add them under Coupon management.</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto rounded-xl border border-admin-800 p-3 bg-admin-950/50">
                {coupons.map((row) => {
                  const code = row[COUPON_FIELDS.COUPON_CODE] || row.id
                  const checked = form.couponCodes.includes(String(code).toUpperCase())
                  return (
                    <label
                      key={code}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer border ${
                        checked ? 'border-admin-500 bg-admin-800/80 text-white' : 'border-admin-700 text-admin-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCouponForCreate(code)}
                        className="rounded border-admin-600"
                      />
                      {couponLabel(row)}
                    </label>
                  )
                })}
              </div>
            )}
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={
                saving ||
                !form.username.trim() ||
                form.password.length < 8 ||
                form.couponCodes.length === 0 ||
                coupons.length === 0
              }
              className="px-5 py-2.5 rounded-xl bg-admin-600 hover:bg-admin-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create partner account'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-admin-900/80 border border-admin-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Existing partners</h2>
        {loading ? (
          <p className="text-admin-400 text-sm">Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="text-admin-400 text-sm">No contract partner accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-admin-700 text-admin-300 text-left">
                  <th className="py-2 pr-4">Username</th>
                  <th className="py-2 pr-4">Display name</th>
                  <th className="py-2 pr-4">Coupons</th>
                  <th className="py-2 pr-2 w-[1%] whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-800 text-admin-100">
                {accounts.map((acc) => (
                  <tr key={acc.id}>
                    <td className="py-2 pr-4 font-medium text-white">{acc.username}</td>
                    <td className="py-2 pr-4">{acc.displayName}</td>
                    <td className="py-2 pr-4">
                      <span className="text-admin-300">{acc.couponCodes.join(', ') || '—'}</span>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Edit"
                          disabled={busyId === acc.id}
                          onClick={() => startEdit(acc)}
                          className="inline-flex items-center justify-center p-2 rounded-lg border border-admin-600 text-admin-200 hover:bg-admin-800 disabled:opacity-40"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          disabled={busyId === acc.id}
                          onClick={() => onDelete(acc)}
                          className="inline-flex items-center justify-center p-2 rounded-lg border border-red-900/60 text-red-300 hover:bg-red-950/40 disabled:opacity-40"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div
            className="w-full max-w-lg rounded-2xl border border-admin-700 bg-admin-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-contract-title"
          >
            <h2 id="edit-contract-title" className="text-lg font-semibold text-white mb-4">
              Edit partner
            </h2>
            <form onSubmit={onSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-admin-400 mb-1">New password (optional)</label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                  className="w-full rounded-xl bg-admin-950 border border-admin-600 px-3 py-2 text-white text-sm"
                  placeholder="Leave blank to keep current"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-admin-400 mb-1">Display name</label>
                <input
                  value={editForm.displayName}
                  onChange={(e) => setEditForm((p) => ({ ...p, displayName: e.target.value }))}
                  className="w-full rounded-xl bg-admin-950 border border-admin-600 px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-admin-400 mb-2">Assigned coupons</label>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto rounded-xl border border-admin-800 p-3 bg-admin-950/50">
                  {coupons.map((row) => {
                    const code = row[COUPON_FIELDS.COUPON_CODE] || row.id
                    const checked = editForm.couponCodes.includes(String(code).toUpperCase())
                    return (
                      <label
                        key={code}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer border ${
                          checked ? 'border-admin-500 bg-admin-800/80 text-white' : 'border-admin-700 text-admin-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCouponForEdit(code)}
                          className="rounded border-admin-600"
                        />
                        {couponLabel(row)}
                      </label>
                    )
                  })}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  disabled={
                    busyId === editId ||
                    editForm.couponCodes.length === 0 ||
                    (editForm.password.length > 0 && editForm.password.length < 8)
                  }
                  className="px-4 py-2 rounded-xl bg-admin-600 text-white text-sm font-semibold disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-4 py-2 rounded-xl border border-admin-600 text-admin-200 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
