Web interface for Centrifugo. See its description in [documentation](http://fzambia.gitbooks.io/centrifugal/content/web/index.html).

This web interface built into Centrifugo. Use command-line option `--admin` to run Centrifugo with admin web interface:

```bash
centrifugo genconfig
centrifugo --config=config.json --admin
```

You can also run Centrifugo with custom path to web interface (for example if you want to contribute into this web and need to test your changes):

```bash
centrifugo --config=config.json --admin --admin_web_path=/path/to/centrifugal/web/app/
```
