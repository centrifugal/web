Centrifugo admin web interface.

To develop (**requires Node v16**):

```
npm i
npm run dev
```

To build production dist:

```
npm run build
```

### Develop with Centrifugo

It's possible to develop admin web UI with Centrifugo using `admin_web_proxy_address` option. So you can run `npm run dev`, also run Centrifugo with config like:

```json
{
    ...
    "admin": true,
    "admin_password": "<REPLACE_WITH_PASSWORD>",
    "admin_secret": "<REPLACE_WITH_SECRET>",
    "admin_web_proxy_address": "http://localhost:3000"
}
```

Then go to `http://localhost:8000` and web UI will be served, with UI auto-reload feature working.

### Run Centrifugo with custom admin UI

You can run Centrifugo with custom path to web interface. You may need to do this for example if you want to contribute into this web interface and need to test your changes. Or you just want to use an alternative admin web interface for Centrifugo. To do this you need to add `admin_web_path` to Centrifugo config file and set its value to file system path to `dist` folder:

```json
{
    ...
    "admin_web_path": "/path/to/centrifugal/web/dist/"
}
```

Run Centrifugo and it will serve custom web interface instead of embedded one.
