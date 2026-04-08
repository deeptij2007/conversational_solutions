/**
 * CommuteModal
 * Shown when the user selects "Yes" for the commute question.
 * Loads the Google Maps JS API (key fetched from /api/config),
 * provides autocomplete address inputs, renders the driving route,
 * and returns the one-way distance (km) via onConfirm(km).
 */
import { useEffect, useRef, useState } from 'react'

// ── Google Maps loader (singleton promise) ────────────────────────────────────

let _mapsPromise = null

function loadMaps(apiKey) {
  if (_mapsPromise) return _mapsPromise
  _mapsPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.places) { resolve(); return }
    window.__onGMapsReady = resolve
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=__onGMapsReady`
    s.async = true
    s.defer = true
    s.onerror = () => { _mapsPromise = null; reject(new Error('Failed to load Google Maps')) }
    document.head.appendChild(s)
  })
  return _mapsPromise
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CommuteModal({ onConfirm, onClose }) {
  const mapDivRef  = useRef(null)
  const homeRef    = useRef(null)
  const destRef    = useRef(null)
  const mapRef     = useRef(null)
  const rendererRef = useRef(null)
  const homeACRef  = useRef(null)
  const destACRef  = useRef(null)

  const [homeFilled, setHomeFilled]   = useState(false)
  const [destFilled, setDestFilled]   = useState(false)
  const [distance, setDistance]       = useState(null)  // km integer
  const [calculating, setCalculating] = useState(false)
  const [error, setError]             = useState(null)
  const [apiKey, setApiKey]           = useState(null)
  const [keyError, setKeyError]       = useState(false)

  // ── 1. Fetch API key from backend, then init Maps ─────────────────────────

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((cfg) => {
        const key = cfg.google_maps_key
        if (!key) { setKeyError(true); return }
        setApiKey(key)
      })
      .catch(() => setKeyError(true))
  }, [])

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // ── 2. Once we have the key, load Maps and set up map + autocompletes ──────

  useEffect(() => {
    if (!apiKey) return

    loadMaps(apiKey)
      .then(() => {
        const maps = window.google.maps

        // Map centred on Montreal
        mapRef.current = new maps.Map(mapDivRef.current, {
          center: { lat: 45.5017, lng: -73.5673 },
          zoom: 11,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'cooperative',
        })

        rendererRef.current = new maps.DirectionsRenderer({ suppressMarkers: false })
        rendererRef.current.setMap(mapRef.current)

        // Autocomplete — Canada only
        const opts = { componentRestrictions: { country: 'ca' }, fields: ['formatted_address', 'geometry'] }

        homeACRef.current = new maps.places.Autocomplete(homeRef.current, opts)
        homeACRef.current.addListener('place_changed', () => {
          const p = homeACRef.current.getPlace()
          if (p?.geometry) { setHomeFilled(true); setDistance(null) }
        })

        destACRef.current = new maps.places.Autocomplete(destRef.current, opts)
        destACRef.current.addListener('place_changed', () => {
          const p = destACRef.current.getPlace()
          if (p?.geometry) { setDestFilled(true); setDistance(null) }
        })
      })
      .catch(() => setError('Failed to load Google Maps. Please try again.'))
  }, [apiKey])

  // ── 3. Calculate route when both places are selected ──────────────────────

  useEffect(() => {
    if (!homeFilled || !destFilled) return
    if (!window.google?.maps) return

    const homePlace = homeACRef.current?.getPlace()
    const destPlace = destACRef.current?.getPlace()
    if (!homePlace?.geometry || !destPlace?.geometry) return

    setCalculating(true)
    setError(null)
    setDistance(null)

    const svc = new window.google.maps.DirectionsService()
    svc.route(
      {
        origin: homePlace.geometry.location,
        destination: destPlace.geometry.location,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        setCalculating(false)
        if (status === 'OK') {
          rendererRef.current.setDirections(result)
          const metres = result.routes[0].legs[0].distance.value
          setDistance(Math.round(metres / 1000))
        } else {
          setError('Could not calculate route. Please check the addresses and try again.')
        }
      },
    )
  }, [homeFilled, destFilled])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function clearHome() {
    if (homeRef.current) homeRef.current.value = ''
    setHomeFilled(false)
    setDistance(null)
  }
  function clearDest() {
    if (destRef.current) destRef.current.value = ''
    setDestFilled(false)
    setDistance(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="commute-modal">
        {/* Close button */}
        <button className="modal-close-btn" onClick={onClose} aria-label="Close">✕</button>

        <h3 className="modal-title">Most frequent commute</h3>
        <p className="modal-desc">
          Accurate commute details are required to help us better understand your daily driving habits.
          This information is secure and will not be shared with any third party.
        </p>

        {keyError ? (
          <div className="modal-key-error">
            <p>Google Maps is not configured. Please contact your administrator.</p>
            <button className="modal-cancel-btn" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            {/* Home address */}
            <div className="modal-field">
              <label className="modal-label">Home address</label>
              <div className="modal-input-wrap">
                <input
                  ref={homeRef}
                  className="modal-input"
                  placeholder="e.g. 123 Main St, Montreal, QC"
                  autoComplete="off"
                />
                {homeFilled && (
                  <button className="modal-clear-btn" onClick={clearHome} title="Clear">✕</button>
                )}
              </div>
            </div>

            {/* Destination address */}
            <div className="modal-field">
              <label className="modal-label">Destination address</label>
              <div className="modal-input-wrap">
                <input
                  ref={destRef}
                  className="modal-input"
                  placeholder="e.g. 1000 De La Gauchetière, Montreal, QC"
                  autoComplete="off"
                />
                {destFilled && (
                  <button className="modal-clear-btn" onClick={clearDest} title="Clear">✕</button>
                )}
              </div>
            </div>

            {/* Map */}
            <div ref={mapDivRef} className="commute-map" />

            {/* Status / distance */}
            {error && <div className="modal-error">{error}</div>}
            {calculating && <div className="modal-status">Calculating route…</div>}
            {distance !== null && (
              <div className="commute-dist-row">
                <span className="commute-dist-dot" />
                <span>
                  Shortest distance to your destination:&nbsp;
                  <strong>{distance} km</strong>
                </span>
              </div>
            )}

            {/* Continue */}
            <button
              className={`modal-continue-btn${distance === null ? ' modal-continue-btn--disabled' : ''}`}
              disabled={distance === null}
              onClick={() => onConfirm(distance)}
            >
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  )
}
