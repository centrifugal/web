function pad(n) {
    // http://stackoverflow.com/a/3313953/1288429
    return (`0${n}`).slice(-2);
}

export function HumanSeconds(seconds) {
    const numyears = Math.floor(seconds / 31536000);
    const numdays = Math.floor((seconds % 31536000) / 86400);
    const numhours = Math.floor(((seconds % 31536000) % 86400) / 3600);
    const numminutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
    const numseconds = (((seconds % 31536000) % 86400) % 3600) % 60;
    let res = '';
    if (numyears > 0) {
        res += `${numyears}y `;
    }
    if (numdays > 0) {
        res += `${numdays}d `;
    }
    if (numhours > 0) {
        res += `${pad(numhours)}h `;
    }
    if (numminutes > 0) {
        res += `${pad(numminutes)}m `;
    }
    if (numseconds > 0) {
        res += `${pad(numseconds)}s`;
    }
    return res;
}

export function HumanSize(bytes, si = false, dp = 1) {
    const thresh = si ? 1000 : 1024;

    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }

    const units = si
        ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
        : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    const r = 10 ** dp;

    do {
        // eslint-disable-next-line no-param-reassign
        bytes /= thresh;
        u += 1;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);

    return bytes.toFixed(dp) + ' ' + units[u];
}

export function SortByKey(array, key) {
    return array.sort((a, b) => {
        const x = a[key]; const y = b[key];
        // eslint-disable-next-line no-nested-ternary
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
}

export function RandomString(length) {
    const result = [];
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i += 1) {
        result.push(characters.charAt(Math.floor(Math.random() * charactersLength)));
    }
    return result.join('');
}
