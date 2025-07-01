import { Button } from '@/components/ui/button'
import { useState } from 'react'

export type FormValues = {
	selectedOptions: string[]
}

export function Main() {
	const [userLocation, setUserLocation] = useState<{
		latitude: number
		longitude: number
	} | null>(null)

	const getUserLocation = () => {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					const { latitude, longitude } = position.coords

					setUserLocation({ latitude, longitude })
					console.log(position)
				},

				(error) => {
					console.error('Error get user location: ', error)
				},
			)
		} else {
			console.log('Geolocation is not supported by this browser')
		}
	}
	console.log(Intl.Locale)
	console.log(Intl.getCanonicalLocales())

	return (
		<>
			<h1>Geolocation App</h1>
			{/* create a button that is mapped to the function which retrieves the users location */}
			<Button onClick={getUserLocation}>Get User Location</Button>
			{/* if the user location variable has a value, print the users location */}
			{userLocation && (
				<div>
					<h2>User Location</h2>
					<p>Latitude: {userLocation.latitude}</p>
					<p>Longitude: {userLocation.longitude}</p>
				</div>
			)}
		</>
	)
}
