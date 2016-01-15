Web interface for Centrifugo. See its description in [documentation](http://fzambia.gitbooks.io/centrifugal/content/web/index.html).

This web interface built into Centrifugo. Use command-line option `--web` to run Centrifugo with web interface:

```bash
centrifugo --config=/path/to/config.json --web
```

You can also run Centrifugo with custom path to web interface (for example if you want to contribute into this web and need to test your changes):

```bash
centrifugo --config=/path/to/config.json --web --web_path=/path/to/centrifugal/web/app/
```
