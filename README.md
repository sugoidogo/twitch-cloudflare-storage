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