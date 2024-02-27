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

## Public Storage

If `public=true`, access is redirected to a client-speicific folder for which the user can write into a folder named after their `user-id` and can read from folders named after others' `user-id`s, allowing users to share data between their clients. An example use case would be allowing a viewer to customize their avatar on a stream by writing the avatar settings into the public folder, to be read later by the avatar overlay.

## JS Modules

These helper modules are beta software. If you encounter any issues, please report them here.
Both of these modules provide a caching interface to allow your web apps to continue functioning if/when your storage server is unusable.

### fetch

```js
import fetchCache from 'https://tcs.yourdomain.com/fetch.mjs'
const config=await fetchCache('https://tcs.yourdomain.com/config.json',
    {headers:{authorization:'OAuth yourtwitchtoken'}})
    .then(response=>response.json());
```

This module contains a single function which mimics the `fetch` builtin. On a sucessful fetch, this function stores the result in persistent browser storage. On a failed fetch, it attemps to return a previoulsy stored response. If that fails, then the original response/error is returned/thrown.

### storage

```js
import { StaticAuthProvider } from '@twurple/auth';
const authProvider = new StaticAuthProvider('yourClientID', 'yourAccessToken');

import WebStorage from 'https://tcs.yourdomain.com/storage.mjs';
const storage=new WebStorage(authProvider);

const config=JSON.parse(storage.getItem('config.json'))
```

This module contains a single class which mimics a `Storage` object, with some additional functions for more control over the cache.
`getItem`, `setItem`, and `removeItem` all return a `Promise<Response>`.
The constructor takes an `authProvider` and a boolean as the second value that defaults to `false` for setting the `public` parameter in fetch requests,
meaning you need a second storage object if you want to use private and public storage.
The extra function `clearCache()` will, shockingly, clear the cache.
The extra function `sync()` will first order the server to remove all stored data, and then send the entire cache to be stored again.