# Twitch Cloudflare Storage

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sugoidogo/twitch-cloudflare-storage)

A simple Cloudflare Worker providing access to R2 Object Storage with Twitch Token Authentication.
Object access is isolated using the user and client ID of the provided authentication token.

## Access Control

To allow a client access to your storage, add their client-id to the KV store under the `ALLOW` key.
To deny a user access to your storage, add their user-id to the KV store under the `DENY` key.
You can use any seperator you wish, including new lines. If the id string is included anywhere in the key, the respective action is taken.

## Quotas

Quotas are defined in bytes and apply to each user individually. They are disabled by default.
It is reccommended to add the `QUOTA.DEFAULT` key to prevent storage abuse. This key sets the default per-user storage quota.
You can also add `QUOTA.<client-id>` to allow additional storage quota for a specific client, for example when one client's use case requires additional storage to be useful, or `QUOTA.<user-id>` for a specific user, for example when selling additional storage space.

## Offline Caching

The static file `/tcs.mjs` is `GET`able without authentication, and can be used with [twurple-auth](https://www.jsdelivr.com/package/npm/@twurple/auth?path=es) for a simple offline cache backed by browser storage. The constructor takes a twurple `authProvider` instance, and comes with the get, put, and delete methods, which each take a path as their first argument, a boolean for public storage as their last, and put accepts a blob or string for the second argument. `get` will only return an error if the request fails *and* there is no cached data to respond with. `put` and `delete` will fail if the request fails, but the cache will still be modified. Use the `sync` function to update the server with the local cache, or use the `reset` function to clear the cache.

```js
get(path,public=false)
put(path,data,public=false)
delete(path,public=false)
sync()
reset()
```

## Public Storage

If `public=true`, access is redirected to a client-speicific folder for which the user can write into a folder named after their `user-id` and can read from folders named after others' `user-id`s, allowing users to share data between their clients. An example use case would be allowing a viewer to customize their avatar on a stream by writing the avatar settings into the public folder, to be read later by the avatar overlay.