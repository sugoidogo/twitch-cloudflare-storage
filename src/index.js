import Path from 'node:path'

function objectNotFound(objectName) {
	return makeResponse(
		`<html><body>R2 object "<b>${objectName}</b>" not found</body></html>`,
		{
			status: 404,
			headers: {
				"content-type": "text/html; charset=UTF-8"
			}
		}
	)
}

function makeResponse(body = undefined, init = undefined) {
	if (init == undefined) {
		init = {}
	} if (!(init.headers instanceof Headers)) {
		init.headers = new Headers(init.headers)
	}
	init.headers.set('Access-Control-Allow-Origin', '*')
	init.headers.set('Access-Control-Allow-Headers', 'Authorization,Client-ID')
	return new Response(body, init)
}

export default {
	async fetch(request, env) {
		try {
			if (request.method === 'OPTIONS') {
				return makeResponse()
			}

			if (!request.headers.has('authorization')) {
				return makeResponse('{"status":401,"message":"missing authorization token"}',
					{ status: 401 }
				)
			}
			let response = await fetch('https://id.twitch.tv/oauth2/validate', {
				headers: {
					'authorization': request.headers.get('authorization')
				}
			})
			if (!response.ok) {
				return response
			}
			response = await response.json()

			const url = new URL(request.url)
			const searchParams = new URLSearchParams(url.searchParams)
			let requestRoot = Path.join(response.user_id, response.client_id)
			let writeRoot = requestRoot

			if (searchParams.get('public') === 'true') {
				requestRoot = Path.join('public', response.client_id)
				writeRoot = Path.join(requestRoot, response.user_id)
			}

			const pathname = url.pathname
			const objectName = Path.join(requestRoot, pathname)
			if (objectName.indexOf(requestRoot) !== 0) {
				return makeResponse(undefined, { status: 400 })
			}

			console.log(`${request.method} object ${objectName}: ${request.url}`)

			if (request.method === "GET") {

				if (pathname.endsWith('/')) {
					const listing = await env.storage.list({ prefix: objectName })
					const response = []
					for (const object of listing.objects) {
						let key = object.key.slice(objectName.length).split('/')[0]
						response.push(key)
					}
					return makeResponse(JSON.stringify(response), {
						headers: {
							'content-type': 'application/json; charset=UTF-8',
						}
					})
				}

				const object = await env.storage.get(objectName, {
					range: request.headers,
					onlyIf: request.headers
				})

				if (object === null) {
					return objectNotFound(objectName)
				}

				const headers = new Headers()
				object.writeHttpMetadata(headers)
				headers.set("etag", object.httpEtag)
				if (object.range) {
					headers.set(
						"content-range",
						`bytes ${object.range.offset}-${object.range.end ??
						object.size - 1}/${object.size}`
					)
				}
				const status = object.body
					? request.headers.get("range") !== null
						? 206
						: 200
					: 304
				return makeResponse(object.body, {
					headers,
					status
				})
			}

			if (request.method === "HEAD") {
				const object = await env.storage.head(objectName)

				if (object === null) {
					return objectNotFound(objectName)
				}

				const headers = new Headers()
				object.writeHttpMetadata(headers)
				headers.set("etag", object.httpEtag)
				return makeResponse(null, {
					headers
				})
			}

			if (request.method === "PUT" || request.method == "POST") {
				if (objectName.indexOf(writeRoot) !== 0) {
					return makeResponse(undefined, { status: 400 })
				}

				const object = await env.storage.put(objectName, request.body, {
					httpMetadata: request.headers
				})
				return makeResponse(null, {
					headers: {
						etag: object.httpEtag
					}
				})
			}

			if (request.method === "DELETE") {
				await env.storage.delete(url.pathname.slice(1))
				return makeResponse()
			}

			return makeResponse(`Unsupported method`, {
				status: 400
			})
		} catch (e) {
			console.error(e)
			throw e
		}
	}
}
