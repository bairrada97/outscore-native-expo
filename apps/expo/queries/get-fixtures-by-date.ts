export const getFixturesByDate = async (args: any) => {
	
	const params = new URLSearchParams(args).toString()

	const data = await fetch(
		`/api/fixtures?${params}`,
	).then(res => res.json())

	return data
}