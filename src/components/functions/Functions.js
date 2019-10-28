function syntaxHighlight(json) {
  // eslint-disable-next-line no-param-reassign
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, (match) => {
    let cls = 'number';
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
    return `<span class="${cls}">${match}</span>`;
  });
}

export function PrettifyJson(json) {
  return syntaxHighlight(JSON.stringify(json, undefined, 4));
}

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

export function SortByKey(array, key) {
  return array.sort((a, b) => {
    const x = a[key]; const y = b[key];
    // eslint-disable-next-line no-nested-ternary
    return ((x < y) ? -1 : ((x > y) ? 1 : 0));
  });
}
