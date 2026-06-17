import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import * as Location from "expo-location"

interface LocationContextValue {
  isInKZ: boolean | null
  isLoading: boolean
}

const LocationContext = createContext<LocationContextValue | null>(null)

export function LocationProvider({ children }: { children: ReactNode }) {
  const [isInKZ, setIsInKZ] = useState<boolean | null>(null)
  const [isLoading, setLoading] = useState(true)

  const detect = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        // If denied, default to KZ (show everything)
        setIsInKZ(true)
        return
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      })
      // Reverse geocode to get country code
      const geocode = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      })
      const country = geocode[0]?.isoCountryCode?.toUpperCase() ?? null
      setIsInKZ(country === "KZ")
    } catch {
      // On error, default to KZ
      setIsInKZ(true)
    }
  }, [])

  useEffect(() => {
    void detect().finally(() => setLoading(false))
  }, [detect])

  const value = useMemo(() => ({ isInKZ, isLoading }), [isInKZ, isLoading])

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

export function useLocation() {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error("useLocation must be used within LocationProvider")
  return ctx
}
