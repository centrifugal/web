export function PrettifyJson(json) {
    return syntaxHighlight(JSON.stringify(json, undefined, 4));
}

function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

var pad = function (n) {
    // http://stackoverflow.com/a/3313953/1288429
    return ('0' + n).slice(-2);
};

export function HumanSeconds(seconds) {
    var numyears = Math.floor(seconds / 31536000);
    var numdays = Math.floor((seconds % 31536000) / 86400); 
    var numhours = Math.floor(((seconds % 31536000) % 86400) / 3600);
    var numminutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
    var numseconds = (((seconds % 31536000) % 86400) % 3600) % 60;
    let res = '';
    if (numyears > 0) {
        res += numyears + 'y ';
    }
    if (numdays > 0) {
        res += numdays + 'd ';
    }
    if (numhours > 0) {
        res += pad(numhours) + 'h ';
    }
    if (numminutes > 0) {
        res += pad(numminutes) + 'm ';
    }
    if (numseconds > 0) {
        res += pad(numseconds) + 's';
    }
    return res;
}

export function SortByKey(array, key) {
    return array.sort(function(a, b) {
        var x = a[key]; var y = b[key];
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
}
