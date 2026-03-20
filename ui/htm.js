// ui/htm.js — htm + React binding (shared by all UI modules)
import React from 'react';
import htm from 'htm';

export const html = htm.bind(React.createElement);
export { React };
