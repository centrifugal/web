import React from 'react';

class LinksPage extends React.Component {
    render() {
        return (
            <main className="p-3 animated fadeIn">
                <p className="lead">Quick links</p>
                <ul>
                    <li className="pb-1"><a href="https://github.com/centrifugal/centrifugo">Centrifugo source code</a></li>
                    <li className="pb-1"><a href="https://centrifugal.github.io/centrifugo/">Centrifugo Documentation</a></li>
                    <li className="pb-1"><a href="https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ">Telegram group</a></li>
                    <li className="pb-1"><a href="https://gitter.im/centrifugal/centrifugo">Gitter chat room</a></li>
                </ul>
            </main>
        );
    }
}

export { LinksPage };
