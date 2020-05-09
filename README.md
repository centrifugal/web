Centrifugo admin web interface.

To develop:

```
npm i
npm run build:dev:watch
```

To build production dist:

```
npm run build:prod
```

You can run Centrifugo with custom path to web interface. You may need to do this for example if you want to contribute into this web interface and need to test your changes. Or you just want to use an alternative admin web interface for Centrifugo. To do this you need to add `admin_web_path` to Centrifugo config file and set its value to file system path to `dist` folder:

```json
{
    ...
    "admin_web_path": "/path/to/centrifugal/web/dist/"
}
```

Run Centrifugo and it will serve custom web interface instead of embedded one.
