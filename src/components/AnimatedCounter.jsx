import React, { useState, useEffect, useRef } from 'react'

const AnimatedCounter = ({ end, suffix = '', duration = 2000, startDelay = 0 }) => {
  const [count, setCount] = useState(end % 1 !== 0 ? '0.0' : '0')
  const [hasStarted, setHasStarted] = useState(false)
  const observerRef = useRef(null)
  const elementRef = useRef(null)

  useEffect(() => {
    // Check if element is already visible
    if (elementRef.current) {
      const rect = elementRef.current.getBoundingClientRect()
      const isVisible = rect.top < window.innerHeight && rect.bottom > 0
      
      if (isVisible && !hasStarted) {
        setTimeout(() => {
          setHasStarted(true)
        }, startDelay)
        return
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasStarted) {
            setTimeout(() => {
              setHasStarted(true)
            }, startDelay)
          }
        })
      },
      { threshold: 0.1 }
    )

    if (elementRef.current) {
      observer.observe(elementRef.current)
      observerRef.current = observer
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [hasStarted, startDelay])

  useEffect(() => {
    if (!hasStarted) return

    let startTime = null
    const startValue = 0

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / duration, 1)
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const currentCount = startValue + (end - startValue) * easeOutQuart
      
      // Handle decimals for values like 4.9
      const displayCount = end % 1 !== 0 
        ? currentCount.toFixed(1) 
        : Math.floor(currentCount)
      
      setCount(displayCount)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setCount(end % 1 !== 0 ? end.toFixed(1) : end.toString())
      }
    }

    requestAnimationFrame(animate)
  }, [hasStarted, end, duration])

  return (
    <span ref={elementRef}>
      {count}{suffix}
    </span>
  )
}

export default AnimatedCounter

