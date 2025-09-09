import axios from 'axios'

export interface LocationData {
	source: string
	ip?: string
	coords: { latitude: number; longitude: number }
	city: string
	region: string
	country: string
}

export async function getUserLocation(): Promise<LocationData> {
	try {
		const position = await new Promise<GeolocationPosition>((resolve, reject) => {
			navigator.geolocation.getCurrentPosition(resolve, reject, {
				timeout: 10000,
			})
		})

		const locationResponse = await axios.get(
			`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`,
		)
		return {
			source: 'geolocation',
			coords: {
				latitude: position.coords.latitude,
				longitude: position.coords.longitude,
			},
			city:
				locationResponse.data.address.city ||
				locationResponse.data.address.town ||
				locationResponse.data.address.village,
			region: locationResponse.data.address.state,
			country: locationResponse.data.address.country,
		}
	} catch (error) {
		console.error(error)

		try {
			const ipResponse = await axios.get<{ ip: string }>(
				'https://api.ipify.org?format=json',
			)
			const locationResponse = await axios.get(
				`https://ipinfo.io/${ipResponse.data.ip}/json`,
			)

			const [lat, lon] = locationResponse.data.loc?.split(',').map(Number) || [0, 0]

			return {
				source: 'ip',
				coords: {
					latitude: lat,
					longitude: lon,
				},
				city: locationResponse.data.city,
				region: locationResponse.data.region,
				country: locationResponse.data.country,
			}
		} catch (ipError) {
			console.error('Failed to get location:', ipError)
			throw new Error('Não foi possível determinar sua localização')
		}
	}
}
