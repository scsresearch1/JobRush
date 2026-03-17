import React, { useState, useEffect } from 'react'
import { 
  ArrowLeftIcon, 
  DocumentTextIcon, 
  ArrowDownTrayIcon,
  CheckCircleIcon,
  UserIcon,
  BriefcaseIcon,
  AcademicCapIcon,
  ChartBarIcon,
  PaperAirplaneIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { generateResumePDF } from '../utils/pdfGenerator'
import AuthModal from './AuthModal'

const SparklesIconSVG = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
)

const ResumeBuilder = ({ onBack }) => {
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [selectedJobRole, setSelectedJobRole] = useState(null)
  const [showSubmissionModal, setShowSubmissionModal] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)

  // Check if user is already authenticated
  useEffect(() => {
    const userData = localStorage.getItem('jobRush_user')
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData)
        if (parsedUser.isAuthenticated) {
          setIsAuthenticated(true)
          setUser(parsedUser)
        }
      } catch (e) {
        // Invalid data, clear it
        localStorage.removeItem('jobRush_user')
      }
    }
  }, [])

  const jobRoles = [
    { id: 'software-engineer', name: 'Software Engineer', icon: '💻', description: 'For developers and programmers' },
    { id: 'data-scientist', name: 'Data Scientist', icon: '📊', description: 'For data analysts and ML engineers' },
    { id: 'product-manager', name: 'Product Manager', icon: '📱', description: 'For product and project managers' },
    { id: 'business-analyst', name: 'Business Analyst', icon: '📈', description: 'For business and financial analysts' },
    { id: 'marketing', name: 'Marketing Specialist', icon: '📢', description: 'For marketing and communications' },
    { id: 'designer', name: 'UI/UX Designer', icon: '🎨', description: 'For designers and creatives' },
    { id: 'consultant', name: 'Consultant', icon: '💼', description: 'For consulting roles' },
    { id: 'general', name: 'General Purpose', icon: '📄', description: 'Versatile template for all roles' }
  ]

  // Templates organized by job role - each role has multiple options
  const templatesByRole = {
    'software-engineer': [
      {
        id: 'tech-modern-minimal',
        name: 'Tech Modern Minimal',
        description: 'Clean, ATS-friendly design perfect for software engineers',
        color: 'from-blue-500 to-cyan-500',
        layout: 'modern-minimal'
      },
      {
        id: 'tech-chronological',
        name: 'Chronological Power',
        description: 'Timeline-based layout showcasing technical career progression',
        color: 'from-orange-500 to-red-500',
        layout: 'chronological'
      },
      {
        id: 'tech-skills-focused',
        name: 'Skills Showcase',
        description: 'Highlights technical skills, languages, and frameworks prominently',
        color: 'from-indigo-500 to-blue-500',
        layout: 'skills-focused'
      },
      {
        id: 'tech-two-column',
        name: 'Two-Column Professional',
        description: 'Sidebar layout with skills and sidebar details',
        color: 'from-purple-500 to-pink-500',
        layout: 'two-column'
      }
    ],
    'data-scientist': [
      {
        id: 'data-academic-professional',
        name: 'Academic Professional',
        description: 'Ideal for data scientists with research background',
        color: 'from-green-500 to-emerald-500',
        layout: 'academic'
      },
      {
        id: 'data-modern-analytics',
        name: 'Modern Analytics',
        description: 'Clean design emphasizing data projects and achievements',
        color: 'from-blue-500 to-cyan-500',
        layout: 'modern-minimal'
      },
      {
        id: 'data-skills-dense',
        name: 'Skills Dense',
        description: 'Comprehensive skills section for technical expertise',
        color: 'from-indigo-500 to-blue-500',
        layout: 'skills-focused'
      },
      {
        id: 'data-project-focused',
        name: 'Project Portfolio',
        description: 'Highlights ML projects and data analysis work',
        color: 'from-teal-500 to-green-500',
        layout: 'project-focused'
      }
    ],
    'product-manager': [
      {
        id: 'pm-executive-classic',
        name: 'Executive Classic',
        description: 'Traditional format with strong emphasis on leadership',
        color: 'from-gray-700 to-gray-900',
        layout: 'executive'
      },
      {
        id: 'pm-strategic-leader',
        name: 'Strategic Leader',
        description: 'Emphasizes product strategy and stakeholder management',
        color: 'from-blue-500 to-indigo-500',
        layout: 'modern-minimal'
      },
      {
        id: 'pm-achievement-focused',
        name: 'Achievement Focused',
        description: 'Quantified results and product impact highlighted',
        color: 'from-purple-500 to-pink-500',
        layout: 'achievement-focused'
      },
      {
        id: 'pm-two-column',
        name: 'Two-Column Executive',
        description: 'Professional sidebar layout for senior PMs',
        color: 'from-slate-600 to-gray-800',
        layout: 'two-column'
      }
    ],
    'business-analyst': [
      {
        id: 'ba-professional-classic',
        name: 'Professional Classic',
        description: 'Traditional business format emphasizing analysis skills',
        color: 'from-gray-700 to-gray-900',
        layout: 'executive'
      },
      {
        id: 'ba-modern-analyst',
        name: 'Modern Analyst',
        description: 'Clean design for contemporary business roles',
        color: 'from-blue-500 to-cyan-500',
        layout: 'modern-minimal'
      },
      {
        id: 'ba-data-focused',
        name: 'Data-Driven Analyst',
        description: 'Highlights analytical tools and methodologies',
        color: 'from-indigo-500 to-blue-500',
        layout: 'skills-focused'
      },
      {
        id: 'ba-consultant-style',
        name: 'Consultant Style',
        description: 'Consulting-focused format with project emphasis',
        color: 'from-slate-600 to-gray-800',
        layout: 'two-column'
      }
    ],
    'marketing': [
      {
        id: 'marketing-creative-bold',
        name: 'Creative Bold',
        description: 'Eye-catching design for marketing professionals',
        color: 'from-purple-500 to-pink-500',
        layout: 'creative'
      },
      {
        id: 'marketing-modern-vibrant',
        name: 'Modern Vibrant',
        description: 'Contemporary design showcasing campaigns and results',
        color: 'from-pink-500 to-rose-500',
        layout: 'modern-minimal'
      },
      {
        id: 'marketing-results-driven',
        name: 'Results Driven',
        description: 'Emphasizes campaign metrics and ROI achievements',
        color: 'from-orange-500 to-red-500',
        layout: 'achievement-focused'
      },
      {
        id: 'marketing-portfolio-style',
        name: 'Portfolio Style',
        description: 'Showcases creative work and brand campaigns',
        color: 'from-purple-500 to-indigo-500',
        layout: 'project-focused'
      }
    ],
    'designer': [
      {
        id: 'design-creative-bold',
        name: 'Creative Bold',
        description: 'Eye-catching design for UI/UX designers',
        color: 'from-purple-500 to-pink-500',
        layout: 'creative'
      },
      {
        id: 'design-minimal-elegant',
        name: 'Minimal Elegant',
        description: 'Clean, design-focused layout showcasing aesthetics',
        color: 'from-gray-700 to-gray-900',
        layout: 'modern-minimal'
      },
      {
        id: 'design-portfolio-showcase',
        name: 'Portfolio Showcase',
        description: 'Highlights design projects and creative work',
        color: 'from-pink-500 to-rose-500',
        layout: 'project-focused'
      },
      {
        id: 'design-two-column',
        name: 'Two-Column Creative',
        description: 'Sidebar layout perfect for design portfolios',
        color: 'from-indigo-500 to-purple-500',
        layout: 'two-column'
      }
    ],
    'consultant': [
      {
        id: 'consultant-executive',
        name: 'Executive Consultant',
        description: 'Traditional consulting format emphasizing expertise',
        color: 'from-gray-700 to-gray-900',
        layout: 'executive'
      },
      {
        id: 'consultant-strategic',
        name: 'Strategic Consultant',
        description: 'Highlights strategic projects and client impact',
        color: 'from-blue-500 to-indigo-500',
        layout: 'modern-minimal'
      },
      {
        id: 'consultant-project-focused',
        name: 'Project Portfolio',
        description: 'Showcases consulting engagements and outcomes',
        color: 'from-slate-600 to-gray-800',
        layout: 'project-focused'
      },
      {
        id: 'consultant-two-column',
        name: 'Two-Column Professional',
        description: 'Professional sidebar layout for senior consultants',
        color: 'from-gray-600 to-slate-700',
        layout: 'two-column'
      }
    ],
    'general': [
      {
        id: 'general-modern-minimal',
        name: 'Modern Minimal',
        description: 'Versatile, ATS-friendly design for all roles',
        color: 'from-blue-500 to-cyan-500',
        layout: 'modern-minimal'
      },
      {
        id: 'general-professional-classic',
        name: 'Professional Classic',
        description: 'Traditional format suitable for any industry',
        color: 'from-gray-700 to-gray-900',
        layout: 'executive'
      },
      {
        id: 'general-chronological',
        name: 'Chronological',
        description: 'Timeline-based layout showing career progression',
        color: 'from-orange-500 to-red-500',
        layout: 'chronological'
      },
      {
        id: 'general-two-column',
        name: 'Two-Column Versatile',
        description: 'Sidebar layout adaptable to any profession',
        color: 'from-indigo-500 to-blue-500',
        layout: 'two-column'
      }
    ]
  }

  // Get templates for selected role or show all if no role selected
  const getAvailableTemplates = () => {
    if (selectedJobRole && templatesByRole[selectedJobRole]) {
      return templatesByRole[selectedJobRole]
    }
    // If no role selected, show general templates
    return templatesByRole['general']
  }

  const resumeTips = [
    {
      title: 'ATS Optimization',
      description: 'Ensure your resume passes Applicant Tracking Systems with proper keywords and formatting',
      icon: '🤖',
      tips: [
        'Use standard section headings (Experience, Education, Skills)',
        'Include relevant keywords from job descriptions',
        'Avoid graphics, tables, or complex formatting',
        'Save as PDF with text-selectable content'
      ]
    },
    {
      title: 'Quantify Achievements',
      description: 'Use numbers and metrics to demonstrate your impact',
      icon: '📊',
      tips: [
        'Instead of "Improved performance", write "Increased efficiency by 40%"',
        'Include percentages, dollar amounts, and timeframes',
        'Show before/after comparisons when possible',
        'Highlight team sizes you managed or projects you led'
      ]
    },
    {
      title: 'Tailor for Each Role',
      description: 'Customize your resume to match specific job requirements',
      icon: '🎯',
      tips: [
        'Reorder skills based on job description priorities',
        'Emphasize relevant experience for each application',
        'Use industry-specific terminology',
        'Match your summary to the role\'s requirements'
      ]
    },
    {
      title: 'Professional Formatting',
      description: 'Create a visually appealing and easy-to-read document',
      icon: '✨',
      tips: [
        'Keep it to 1-2 pages (2 pages for 10+ years experience)',
        'Use consistent fonts and spacing throughout',
        'Include white space for readability',
        'Use bullet points for easy scanning'
      ]
    },
    {
      title: 'Power Verbs',
      description: 'Start bullet points with action verbs that demonstrate leadership',
      icon: '🚀',
      tips: [
        'Use verbs like: Led, Developed, Implemented, Optimized',
        'Avoid weak verbs like: Worked, Did, Made, Helped',
        'Show action and results in every bullet',
        'Use present tense for current roles, past tense for previous'
      ]
    },
    {
      title: 'Contact & Links',
      description: 'Make it easy for recruiters to reach you',
      icon: '📧',
      tips: [
        'Include professional email address',
        'Add LinkedIn profile URL (customize it)',
        'Include GitHub/Portfolio if relevant',
        'Use a professional phone number format'
      ]
    }
  ]

  const handleDownload = () => {
    try {
      // Generate and download the PDF
      generateResumePDF(selectedTemplate, selectedJobRole)
      
      // Show success message and move to next step
      setTimeout(() => {
        setCurrentStep(3)
      }, 500)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('There was an error generating your resume. Please try again.')
    }
  }

  const handleSubmitForReview = () => {
    // Check authentication before submission
    if (!isAuthenticated) {
      setShowAuthModal(true)
      return
    }
    setShowSubmissionModal(true)
  }

  const handleAuthSuccess = (userData) => {
    setIsAuthenticated(true)
    setUser(userData)
    setShowAuthModal(false)
    // If file was already selected, set it now
    // The file input will need to be clicked again, but user is now authenticated
  }

  const steps = [
    {
      title: 'Resume Building Tips',
      component: (
        <div className="space-y-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl mb-4">
              <DocumentTextIcon className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Master the Art of Resume Building
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Learn proven strategies from our 20+ years of placement expertise
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resumeTips.map((tip, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-white to-gray-50 p-6 rounded-xl border border-gray-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className="text-4xl mb-4">{tip.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{tip.title}</h3>
                <p className="text-gray-600 mb-4 text-sm">{tip.description}</p>
                <ul className="space-y-2">
                  {tip.tips.map((tipItem, tipIndex) => (
                    <li key={tipIndex} className="flex items-start space-x-2 text-sm text-gray-700">
                      <CheckCircleIcon className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                      <span>{tipItem}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex justify-center mt-8">
            <button
              onClick={() => setCurrentStep(1)}
              className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:shadow-2xl transition transform hover:scale-105 flex items-center space-x-2"
            >
              <span>Explore Templates</span>
              <ArrowLeftIcon className="w-5 h-5 rotate-180" />
            </button>
          </div>
        </div>
      )
    },
    {
      title: 'Select Job Role',
      component: (
        <div className="space-y-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Choose Your Target Job Role
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We'll customize your template with role-specific sections and keywords
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {jobRoles.map((role) => (
              <div
                key={role.id}
                onClick={() => setSelectedJobRole(role.id)}
                className={`bg-white rounded-xl border-2 p-6 cursor-pointer transition-all duration-300 transform hover:scale-105 text-center ${
                  selectedJobRole === role.id
                    ? 'border-primary-600 shadow-xl bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300 hover:shadow-lg'
                }`}
              >
                {selectedJobRole === role.id && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                    <CheckCircleIcon className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div className="text-5xl mb-3">{role.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{role.name}</h3>
                <p className="text-sm text-gray-600">{role.description}</p>
              </div>
            ))}
          </div>

          {selectedJobRole && (
            <div className="flex justify-center space-x-4 mt-8">
              <button
                onClick={() => setCurrentStep(0)}
                className="bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-300 transition"
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStep(2)}
                className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-xl transition transform hover:scale-105 flex items-center space-x-2"
              >
                <span>View Templates</span>
                <ArrowLeftIcon className="w-5 h-5 rotate-180" />
              </button>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Choose Your Template',
      component: (
        <div className="space-y-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Select Your Perfect Resume Template
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {selectedJobRole 
                ? `Choose from ${getAvailableTemplates().length} professionally designed templates for ${jobRoles.find(r => r.id === selectedJobRole)?.name}`
                : 'Choose from professionally designed templates optimized for ATS systems'}
            </p>
          </div>

          {!selectedJobRole && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
              <p className="text-yellow-800 text-center">
                💡 <strong>Tip:</strong> Select a job role first to see role-specific templates, or choose from general templates below.
              </p>
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getAvailableTemplates().map((template) => (
              <div
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={`relative bg-white rounded-xl border-2 p-6 cursor-pointer transition-all duration-300 transform hover:scale-105 ${
                  selectedTemplate === template.id
                    ? 'border-primary-600 shadow-2xl'
                    : 'border-gray-200 hover:border-primary-300 hover:shadow-xl'
                }`}
              >
                {selectedTemplate === template.id && (
                  <div className="absolute top-4 right-4 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                    <CheckCircleIcon className="w-6 h-6 text-white" />
                  </div>
                )}
                
                <div className={`w-full h-48 bg-gradient-to-br ${template.color} rounded-lg mb-4 flex items-center justify-center`}>
                  <DocumentTextIcon className="w-16 h-16 text-white opacity-80" />
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-2">{template.name}</h3>
                <p className="text-gray-600 mb-4 text-sm">{template.description}</p>
              </div>
            ))}
          </div>

          {selectedTemplate && (
            <div className="flex justify-center space-x-4 mt-8">
              <button
                onClick={() => {
                  setSelectedTemplate(null)
                  setCurrentStep(1)
                }}
                className="bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-300 transition"
              >
                Back
              </button>
              <button
                onClick={handleDownload}
                className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-xl transition transform hover:scale-105 flex items-center space-x-2"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                <span>Download Template</span>
              </button>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Submit for Review',
      component: (
        <div className="space-y-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl mb-4">
              <CheckCircleIcon className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Template Downloaded Successfully!
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Now get expert feedback from our human mentors to make your resume stand out
            </p>
          </div>

          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-8 border border-gray-200">
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Expert Human Review</h3>
                    <p className="text-gray-600">
                      Our experienced team will review your resume and provide personalized feedback
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <ChartBarIcon className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Detailed Feedback</h3>
                    <p className="text-gray-600">
                      Receive comprehensive feedback on formatting, content, ATS optimization, and industry-specific recommendations
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <SparklesIconSVG />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">24-48 Hour Turnaround</h3>
                    <p className="text-gray-600">
                      Get your reviewed resume back within 24-48 hours with actionable improvements
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* File Upload Section */}
            <div className="bg-white rounded-2xl p-8 border-2 border-dashed border-gray-300 hover:border-primary-400 transition">
              <div className="text-center">
                <DocumentTextIcon className="w-16 h-16 text-primary-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Upload Your Resume</h3>
                <p className="text-gray-600 mb-6">
                  Upload your completed resume (PDF, DOC, or DOCX) for expert review
                </p>
                
                <input
                  type="file"
                  id="resume-upload"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files[0]
                    if (file) {
                      // Check if user is authenticated before allowing upload
                      if (!isAuthenticated) {
                        setShowAuthModal(true)
                        e.target.value = '' // Clear the file input
                        return
                      }
                      setUploadedFile(file)
                    }
                  }}
                  className="hidden"
                />
                
                <label
                  htmlFor="resume-upload"
                  onClick={(e) => {
                    if (!isAuthenticated) {
                      e.preventDefault()
                      setShowAuthModal(true)
                    }
                  }}
                  className="inline-flex items-center space-x-2 bg-primary-100 text-primary-700 px-6 py-3 rounded-xl font-semibold hover:bg-primary-200 transition cursor-pointer"
                >
                  <DocumentTextIcon className="w-5 h-5" />
                  <span>{uploadedFile ? 'Change File' : 'Choose File'}</span>
                </label>

                {!isAuthenticated && (
                  <p className="mt-3 text-sm text-gray-600 text-center">
                    <span className="text-primary-600 font-semibold">Note:</span> You'll need to sign in or create an account to upload your resume
                  </p>
                )}

                {isAuthenticated && user && (
                  <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-center space-x-2">
                      <CheckCircleIcon className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-green-800">
                        Signed in as <strong>{user.name || user.email}</strong>
                      </span>
                    </div>
                  </div>
                )}

                {uploadedFile && (
                  <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <CheckCircleIcon className="w-6 h-6 text-green-600" />
                        <div>
                          <p className="font-semibold text-gray-900">{uploadedFile.name}</p>
                          <p className="text-sm text-gray-600">
                            {(uploadedFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setUploadedFile(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-center space-x-4 mt-8">
            <button
              onClick={() => setCurrentStep(2)}
              className="bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-300 transition"
            >
              Back
            </button>
            <button
              onClick={handleSubmitForReview}
              disabled={!uploadedFile}
              className={`px-8 py-3 rounded-xl font-semibold hover:shadow-xl transition transform hover:scale-105 flex items-center space-x-2 ${
                uploadedFile
                  ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <PaperAirplaneIcon className="w-5 h-5" />
              <span>Submit for Human Mentor Review</span>
            </button>
          </div>
        </div>
      )
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-400 rounded-lg flex items-center justify-center">
                <BriefcaseIcon className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold gradient-text">JobRush.ai</span>
            </div>
            <button
              onClick={onBack}
              className="flex items-center space-x-2 text-gray-700 hover:text-primary-600 transition"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span>Back to Home</span>
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            {steps.map((step, index) => (
              <React.Fragment key={index}>
                <div className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                      index <= currentStep
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {index < currentStep ? (
                      <CheckCircleIcon className="w-6 h-6" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className={`ml-2 text-sm font-medium hidden md:block ${
                    index <= currentStep ? 'text-primary-600' : 'text-gray-400'
                  }`}>
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-4 transition-all duration-300 ${
                      index < currentStep ? 'bg-primary-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div
          key={currentStep}
          className="animate-in fade-in slide-in-from-right"
          style={{ animation: 'fade-in 0.5s ease-out, slide-in-from-right 0.5s ease-out' }}
        >
          {steps[currentStep].component}
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Submission Modal */}
      {showSubmissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in">
            <button
              onClick={() => setShowSubmissionModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full mb-4">
                <CheckCircleIcon className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Resume Submitted Successfully!
              </h3>
              <p className="text-gray-600 mb-6">
                Your resume has been sent to our expert mentors. You'll receive detailed feedback within 24-48 hours.
              </p>
              <button
                onClick={() => {
                  setShowSubmissionModal(false)
                  onBack()
                }}
                className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-xl transition transform hover:scale-105"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ResumeBuilder

