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

function getRoot(client_id,user_id=undefined,isPublic=false,writeable=false){
	if(!isPublic){
		return Path.join(user_id, client_id)
	}if(!writeable){
		return Path.join('public', client_id)
	}return Path.join('public', client_id, user_id)
}

async function getPathSize(prefix){
	let size=0
	for(object of await env.storage.list({prefix:prefix})){
		size+=object.size
	}
	return size
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

async function getStatic(env,objectName){
	if(objectName[0]==='/'){
		objectName=objectName.slice(1)
	}

	const object = await env.storage.get(objectName)

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
	const status = 200
	return makeResponse(object.body, {
		headers,
		status
	})
}

export default {
	async fetch(request, env) {
		try {
			if (request.method === 'OPTIONS') {
				return makeResponse()
			}

			const url = new URL(request.url)
			const pathname = url.pathname
			if(pathname=='/tcs.mjs'){
				return getStatic(env,pathname)
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

			const DENY=await env.config.get('DENY') || ''
			const ALLOW=await env.config.get('ALLOW') || ''
			if(DENY.includes(response.user_id) || !ALLOW.includes(response.client_id)){
				return makeResponse(undefined,{'status':403})
			}

			const searchParams = new URLSearchParams(url.searchParams)
			const isPublic=request.headers.get('public')==='true'
			const requestRoot=getRoot(response.client_id,response.user_id,isPublic,false)

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
				const writeRoot=getRoot(response.client_id,response.user_id,isPublic,true)
				if (objectName.indexOf(writeRoot) !== 0) {
					return makeResponse(undefined, { status: 400 })
				}

				const defaultQuota=Number(env.config.get('QUOTA.DEFAULT')) || 0
				const clientQuota=Number(env.config.get('QUOTA.'+response.client_id)) || 0
				const userQuota=Number(env.config.get('QUOTA.'+response.user_id)) || 0
				const totalQuota=defaultQuota+clientQuota+userQuota

				if(totalQuota>0){
					const objectSize=Number(request.headers.get('content-length'))
					const altWriteRoot=getRoot(response.client_id,response.user_id,!isPublic,true)
					const userDataSize=await getPathSize(writeRoot)+await getPathSize(altWriteRoot)
					const oldObjectSize=(await env.storage.head(objectName)).size || 0
					const requestQuotaSize=userDataSize+objectSize-oldObjectSize
	
					if(requestQuotaSize>totalQuota){
						return response(undefined,{status:413})
					}
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
				if (objectName.indexOf(writeRoot) !== 0) {
					return makeResponse(undefined, { status: 400 })
				}

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
