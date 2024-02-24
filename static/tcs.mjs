import localforage from 'https://cdn.jsdelivr.net/npm/localforage/+esm'

function getURL(path,isPublic){
    const url=new URL(path,import.meta.url)
    url.searchParams.append('public',isPublic)
    return url
}

function toDataURL(blob){
    return new Promise((resolve,reject)=>{
        const fileReader=new FileReader()
        fileReader.onload=(event)=>resolve(event.target.result)
        fileReader.onabort=(event)=>reject(event)
        fileReader.onerror=(event)=>reject(event)
        fileReader.readAsDataURL(blob)
    })
}

export default class {
    constructor(authProvider){
        this.authProvider=authProvider
        this.localStorage=localforage.createInstance({name:authProvider.clientId+'.'+import.meta.url})
    }

    async getHeaders(){
        const token=await this.authProvider.getAnyAccessToken()
        return {authorization:'OAuth '+token.accessToken}
    }

    async get(path,isPublic=false){
        const url=getURL(path,isPublic)
        if(isPublic){
            path='public/'+path
        }
        return fetch(url,{headers:await this.getHeaders()}).then(async response=>{
            if(!response.ok){
                throw 'failed to fetch'
            }else{
                response.blob().then(blob=>{
                    return toDataURL(blob)
                }).then(dataURL=>{
                    this.localStorage.setItem(path,dataURL)
                })
                return response
            }
        }).catch(async ()=>fetch(await this.localStorage.getItem(path)))
    }

    async put(path,data,isPublic=false){
        const url=getURL(path,isPublic)
        if(isPublic){
            path='public/'+path
        }
        if(!(data instanceof Blob)){
            data=new Blob([data])
        }
        data=await toDataURL(data)
        this.localStorage.setItem(path,data)
        return fetch(url,{method:'PUT',body:data,headers:await this.getHeaders()})
    }

    async delete(path,isPublic=false){
        const url=getURL(path,isPublic)
        if(isPublic){
            path='public/'+path
        }
        this.localStorage.removeItem(path)
        return fetch(url,{headers:await this.getHeaders()})
    }

}