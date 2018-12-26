Centrifugo admin web interface.

To develop:

```
yarn
npm run build:dev:watch
```

To build production dist:

```
npm run build:prod
```

You can run Centrifugo with custom path to web interface (for example if you want to contribute into admin web panel and need to test your changes):

```bash
centrifugo --config=config.json --admin --admin_web_path=/path/to/centrifugal/web/dist/
```
