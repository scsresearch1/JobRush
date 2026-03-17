import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon, BriefcaseIcon } from '@heroicons/react/24/outline'

const CareersComingSoonPage = () => (
  <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4">
    <div className="max-w-lg w-full text-center">
      <Link
        to="/"
        className="inline-flex items-center text-gray-600 hover:text-primary-600 mb-8 transition font-medium"
      >
        <ArrowLeftIcon className="w-5 h-5 mr-2" />
        Back to Home
      </Link>
      <div className="bg-white rounded-2xl shadow-xl p-12 border border-gray-100">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
          <BriefcaseIcon className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Careers at JobRush.ai</h1>
        <p className="text-xl text-primary-600 font-semibold mb-4">Coming Soon</p>
        <p className="text-gray-600 mb-8">
          We&apos;re building our team. Check back soon for opportunities to join us in transforming career acceleration.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition"
        >
          Return Home
        </Link>
      </div>
    </div>
  </div>
)

export default CareersComingSoonPage
