import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, UserIcon, EnvelopeIcon, PencilIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'

const Profile = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('jobRush_user') || '{}')
    } catch {
      return {}
    }
  })
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    linkedin: '',
  })

  const handleSave = () => {
    const updated = { ...user, ...formData }
    localStorage.setItem('jobRush_user', JSON.stringify(updated))
    setUser(updated)
    setIsEditing(false)
  }

  return (
    <div>
      <Link
        to="/dashboard"
        className="inline-flex items-center text-gray-600 hover:text-primary-600 mb-6"
      >
        <ArrowLeftIcon className="w-5 h-5 mr-2" />
        Back to Dashboard
      </Link>

      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <UserIcon className="w-8 h-8 text-primary-600" />
          Profile Setup
        </h1>
        <p className="text-gray-600 mb-6">
          Your profile is used for resume evaluation and interview preparation.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block font-medium text-gray-700 mb-2">Full Name</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={!isEditing}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl disabled:bg-gray-50"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-gray-700 mb-2">Email</label>
            <div className="relative">
              <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!isEditing}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl disabled:bg-gray-50"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-gray-700 mb-2">Phone (optional)</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              disabled={!isEditing}
              placeholder="+1 (555) 123-4567"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block font-medium text-gray-700 mb-2">LinkedIn (optional)</label>
            <input
              type="url"
              value={formData.linkedin}
              onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
              disabled={!isEditing}
              placeholder="https://linkedin.com/in/yourprofile"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl disabled:bg-gray-50"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3 flex-wrap">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700"
              >
                Save Changes
              </button>
              <button
                onClick={() => { setIsEditing(false); setFormData({ name: user?.name, email: user?.email, phone: formData.phone, linkedin: formData.linkedin }); }}
                className="px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700"
            >
              <PencilIcon className="w-5 h-5" />
              Edit Profile
            </button>
          )}
          <button
            onClick={() => {
              localStorage.removeItem('jobRush_user')
              navigate('/')
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-red-600 px-6 py-3"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}

export default Profile
