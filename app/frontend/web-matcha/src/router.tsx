import { Route, Routes } from "react-router";
import { NotFound } from "./pages/errors/404";

export function Router() {
	return (
		<Routes>
			<Route path="/" element={<p>home</p>} />

			<Route path="*" element={<NotFound />} />
		</Routes>
	)
}