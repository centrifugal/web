Web interface for Centrifuge >= 0.8.0 and Centrifugo. See its description in [documentation](http://fzambia.gitbooks.io/centrifugal/content/web/index.html).

You can serve this application using `Nginx` - see `index.html` in `app` folder.

Also Centrifuge and Centrifugo have command-line option `--web` to serve this web interface:

```bash
centrifuge --config=/path/to/config.json --web=/path/to/centrifugal/web/app/
```

or

```bash
centrifugo --config=/path/to/config.json --web=/path/to/centrifugal/web/app/
```

