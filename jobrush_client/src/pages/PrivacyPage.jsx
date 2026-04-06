import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'

const PrivacyPage = () => (
  <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <Link
        to="/"
        className="inline-flex items-center text-gray-600 hover:text-primary-600 mb-10 transition font-medium"
      >
        <ArrowLeftIcon className="w-5 h-5 mr-2" />
        Back to Home
      </Link>

      <article className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 sm:p-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
            <ShieldCheckIcon className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Privacy Statement</h1>
            <p className="text-gray-500 text-sm">Last updated: 2024</p>
          </div>
        </div>

        <div className="prose prose-gray max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Blockchain-Secured Data Storage</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>All data is stored using blockchain—highly confidential.</strong> JobRush.ai employs blockchain technology to ensure the integrity, immutability, and confidentiality of your personal and professional information. This approach provides a level of security that traditional centralized databases cannot match.
            </p>
            <p className="text-gray-700 leading-relaxed">
              When you upload a resume, complete an interview, or generate application materials, your data is processed and stored in a manner that leverages blockchain&apos;s distributed and tamper-evident properties. Unauthorized access, alteration, or deletion of your information is prevented by design.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">What We Collect</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              JobRush.ai collects only the information necessary to deliver our services:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
              <li><strong>Resume data:</strong> Skills, experience, education, and projects extracted from your uploaded documents</li>
              <li><strong>Account information:</strong> Email address and name for authentication</li>
              <li><strong>Behavioral metrics:</strong> Frame-level analysis from mock interviews (eye contact, expression, composure)—processed locally in your browser wherever possible</li>
              <li><strong>Generated content:</strong> AI-generated recommendations, SOPs, and cover letters</li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              All such data, once stored, is secured using blockchain technology to maintain confidentiality and prevent unauthorized disclosure.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Local Processing & Privacy-First Design</h2>
            <p className="text-gray-700 leading-relaxed">
              JobRush.ai is designed with a privacy-first architecture. Sensitive operations—including resume parsing, video frame analysis, and facial expression detection—are performed locally on your device. Raw video and biometric data are not transmitted to our servers. Only structured, anonymized metrics are used for AI-powered feedback when you choose to use those features.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Data Retention & Your Rights</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              You retain control over your data. You may request access, correction, or deletion of your information at any time. Data stored on the blockchain remains immutable for audit and compliance purposes, but we provide mechanisms to revoke access and anonymize records where technically feasible.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Contact</h2>
            <p className="text-gray-700 leading-relaxed">
              For questions about this Privacy Statement or our data practices, please reach out through our Help Center. Your trust is paramount—we are committed to maintaining the highest standards of confidentiality through blockchain-secured storage and privacy-by-design principles.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            <strong>Summary:</strong> All data is stored using blockchain—highly confidential. JobRush.ai does not sell your data. We use it solely to deliver and improve our career acceleration services.
          </p>
        </div>
      </article>
    </div>
  </div>
)

export default PrivacyPage
