## Architecture

Below are diagrams illustrating the current implementation of file upload and download in the application.

### File Upload

```mermaid
sequenceDiagram
    actor U as User
    participant MF as Main Frontend
    participant MB as Main Backend
    note over MF,MB: controlled by the developer,<br/> in the long-term SNS DAO
    U ->> MF: Logged into the app
    MF ->> MB: getJournalBucket()
    MB -->> MF: <canisterId-1>
    create participant UJ as User Journal <br /> <canisterId-1>
    MF --> UJ: creating an actor to work with <canisterId-1>
    MF ->> UJ: listStorages()
    UJ -->> MF: <canisterId-2>
    create participant US as User Storage <br /> <canisterId-2>
    MF --> US: creating an actor to work with <canisterId-2>
    note over UJ,US: controlled by the user
    U ->> MF: Uploads the file
    par Uploading a file
        MF -->> MF: splitting into chunks, encryption<br/> and uploading directly into<br/> the user's storage canister
        MF ->> US: initUpload()
        US -->> MF: batchId
        loop Every chunk
            MF -->> MF: encrypt()
            MF ->> US: uploadChunk()
            US -->> MF: <chunkId>
        end
        MF ->> US: commitUpload(...)
        US -->> UJ: addFile(...)
        US -->> MF: ok
    end
```

### File Download

```mermaid
sequenceDiagram
    actor U as User
    participant MF as Main Frontend
    participant MB as Main Backend
    note over MF,MB: controlled by the developer,<br/> in the long-term SNS DAO
    U ->> MF: Logged into the app
    MF ->> MB: getJournalBucket()
    MB -->> MF: <canisterId-1>
    create participant UJ as User Journal <br /> <canisterId-1>
    MF --> UJ: creating an actor to work with <canisterId-1>
    MF ->> UJ: listStorages()
    UJ -->> MF: <canisterId-2>
    create participant US as User Storage <br /> <canisterId-2>
    MF --> US: creating an actor to work with <canisterId-2>
    note over UJ,US: controlled by the user
    U ->> MF: Downloads the file
    par Downloading a file
        MF ->> US: getChunks(fileId)
        US -->> MF: [chunkIds]
        loop Every chunk
            MF ->> US: getChunk()
            US -->> MF: <content>
            MF -->> MF: decrypt() content
        end
        MF -->> MF: joining the chunks, writing<br/> the stream to a file and <br />transferring it to the browser
        MF -->> U: File
    end
```

### Current Architecture Limitation

Although user-controlled canisters provide data ownership, the frontend remains a central point of failure. If the app’s controller disables the frontend or backend, the user might lose access to their own canisters and data.

## V2

### Storage Management

```mermaid
sequenceDiagram
    title Rabbithole V2
    actor U as User
    participant MF as Main frontend
    participant MB as Main backend
    participant S as User Storage
    U->>MF: Logged into the app
    MF->>MB: list()
    MB-->>MF: [<canisterId>]
    U->>MF: Controls the canister
    note over U,MF: creates, adds an existing one, <br/>updates, makes backups and restores, <br/>and so on.
    U->>MF: Creates the storage
    note over U,MF: sets various storage parameters - <br/>group access, rights, encryption
    MF->>S: ic.install_code()
    S-->>MF: ok
    MF->>MB: add(<canisterId>)
    MB-->>MF: ok
    MF->>MB: list()
    note right of MF: updating the list of canisters
    MB-->>MF: [<canisterId>]
    U->>S: Opens <canisterId>.ic0.io
    note over U,S: the user needs to log in to the application and find out the <principalId>
    U->>S: Logged into the app
    alt hasAccess:
        note over MF,S: Access is allowed and the user can work with the storage.
        S-->>MF: ok
    else hasntAccess:
        note over MF,S: Access is denied. The user sees his <principalId>.
        S-->>MF: ok
        note over U,MF: Adding a new user to <br/>access the storage
        U->>MF: Add a user
        MF->>S: addRights(<principalId>)
        alt isOwner:
            S-->>MF: ok
        else isntOwner:
            S-->>MF: err
        end
    end
```

### Interaction Within a Single Canister

```mermaid
sequenceDiagram
    title Rabbithole V2
    actor U as User
    participant S as User Storage
    U->>S: Logged into the app
    par:
        U->>S: Uploads the file
        activate S
        note left of S: splitting into chunks, encryption<br/> and uploading directly into<br/> the canister
        S-->>S: upload()
        deactivate S
    end
    par:
        U->>S: Downloads the file
        activate S
        note left of S:joining the chunks, writing<br/> the stream to a file
        S-->>S: download()
        deactivate S
        note over U,S: transferring it to the browser
        S-->>U: File
    end
```
