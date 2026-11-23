// Traduction automatique de l'affichage — src/lib/autoTranslate.js
// Quand la langue est « English », les textes français connus (Text, placeholder,
// Alert) sont remplacés à l'affichage. Ne plante jamais : en cas de souci, on ne fait rien.
import * as ReactNS from 'react';
import { Text, TextInput, Alert } from 'react-native';
import { getPrefs, translate } from './prefs';

let installed = false;

function tr(v) {
  try {
    if (getPrefs().lang !== 'en') return v;
    if (typeof v === 'string') return translate('en', v);
    if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? translate('en', x) : x));
  } catch (e) {}
  return v;
}

function patchProps(type, props) {
  try {
    if (!props || getPrefs().lang !== 'en') return props;
    if (type === Text) {
      if (props.children != null) return { ...props, children: tr(props.children) };
    } else if (type === TextInput) {
      let p = props;
      if (typeof p.placeholder === 'string') p = { ...p, placeholder: tr(p.placeholder) };
      return p;
    }
  } catch (e) {}
  return props;
}

function wrapJsx(mod, name) {
  try {
    const orig = mod && mod[name];
    if (typeof orig !== 'function' || orig.__zuno) return;
    const wrapped = function (type, props, ...rest) {
      return orig(type, patchProps(type, props), ...rest);
    };
    wrapped.__zuno = true;
    mod[name] = wrapped;
  } catch (e) {}
}

export function installAutoTranslate() {
  if (installed) return;
  installed = true;
  try {
    try {
      const rt = require('react/jsx-runtime');
      wrapJsx(rt, 'jsx');
      wrapJsx(rt, 'jsxs');
    } catch (e) {}
    try {
      const dev = require('react/jsx-dev-runtime');
      wrapJsx(dev, 'jsxDEV');
    } catch (e) {}
    try {
      const R = ReactNS.default || ReactNS;
      const orig = R.createElement;
      if (typeof orig === 'function' && !orig.__zuno) {
        const w = function (type, props, ...children) {
          if (type === Text && children.length) children = children.map((c) => tr(c));
          return orig.call(R, type, patchProps(type, props), ...children);
        };
        w.__zuno = true;
        R.createElement = w;
      }
    } catch (e) {}
    try {
      const origAlert = Alert.alert;
      Alert.alert = function (title, message, buttons, options) {
        try {
          if (getPrefs().lang === 'en') {
            title = tr(title);
            message = tr(message);
            if (Array.isArray(buttons)) buttons = buttons.map((b) => (b && b.text ? { ...b, text: tr(b.text) } : b));
          }
        } catch (e) {}
        return origAlert.call(Alert, title, message, buttons, options);
      };
    } catch (e) {}
  } catch (e) {}
}
