const React = require('react');

module.exports = new Proxy({}, {
  get: (_, name) => {
    if (name === '__esModule') return true;
    const Icon = (props) => React.createElement('Icon', { iconName: String(name), ...props });
    Icon.displayName = `Icon_${String(name)}`;
    return Icon;
  }
});
