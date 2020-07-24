import { repeat } from './utilities'
const Entities = require('html-entities').AllHtmlEntities;
const htmlentities = (new Entities()).encode;
const css = require('css');

var rules = {}

rules.paragraph = {
  filter: 'p',

  replacement: function (content) {
    return '\n\n' + content + '\n\n'
  }
}

rules.lineBreak = {
  filter: 'br',

  replacement: function (content, node, options) {
    return options.br + '\n'
  }
}

rules.heading = {
  filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],

  replacement: function (content, node, options) {
    var hLevel = Number(node.nodeName.charAt(1))

    if (options.headingStyle === 'setext' && hLevel < 3) {
      var underline = repeat((hLevel === 1 ? '=' : '-'), content.length)
      return (
        '\n\n' + content + '\n' + underline + '\n\n'
      )
    } else {
      return '\n\n' + repeat('#', hLevel) + ' ' + content + '\n\n'
    }
  }
}

rules.blockquote = {
  filter: 'blockquote',

  replacement: function (content) {
    content = content.replace(/^\n+|\n+$/g, '')
    content = content.replace(/^/gm, '> ')
    return '\n\n' + content + '\n\n'
  }
}

rules.list = {
  filter: ['ul', 'ol'],

  replacement: function (content, node) {
    var parent = node.parentNode
    if (parent.nodeName === 'LI' && parent.lastElementChild === node) {
      return '\n' + content
    } else {
      return '\n\n' + content + '\n\n'
    }
  }
}

rules.listItem = {
  filter: 'li',

  replacement: function (content, node, options) {
    content = content
        .replace(/^\n+/, '') // remove leading newlines
        .replace(/\n+$/, '\n') // replace trailing newlines with just a single one

    var prefix = options.bulletListMarker + ' '
    content = content.replace(/\n/gm, '\n    ') // indent

    const joplinCheckbox = joplinCheckboxInfo(node);
    if (joplinCheckbox) {
      prefix = '- [' + (joplinCheckbox.checked ? 'x' : ' ') + '] ';
    } else {
      var parent = node.parentNode
      if (parent.nodeName === 'OL') {
        var start = parent.getAttribute('start')
        var index = Array.prototype.indexOf.call(parent.children, node)
        var indexStr = (start ? Number(start) + index : index + 1) + ''
        // The content of the line that contains the bullet must align wih the following lines.
        //
        // i.e it should be:
        //
        // 9.  my content
        //     second line
        // 10. next one
        //     second line
        //
        // But not:
        //
        // 9.  my content
        //     second line
        // 10.  next one
        //     second line
        //
        prefix = indexStr + '.' + ' '.repeat(3 - indexStr.length)
      }
    } 

    return (
      prefix + content + (node.nextSibling && !/\n$/.test(content) ? '\n' : '')
    )
  }
}

// To handle code that is presented as below (see https://github.com/laurent22/joplin/issues/573)
//
// <td class="code">
//   <pre class="python">
//     <span style="color: #ff7700;font-weight:bold;">def</span> ma_fonction
//   </pre>
// </td>
function isCodeBlockSpecialCase1(node) {
  const parent = node.parentNode
  return parent.classList.contains('code') && parent.nodeName === 'TD' && node.nodeName === 'PRE'
}

// To handle PRE tags that have a monospace font family. In that case
// we assume it is a code block.
function isCodeBlockSpecialCase2(node) {
  if (node.nodeName !== 'PRE') return false;

  const style = node.getAttribute('style');
  if (!style) return false;
  const o = css.parse('pre {' + style + '}');
  if (!o.stylesheet.rules.length) return;
  const fontFamily = o.stylesheet.rules[0].declarations.find(d => d.property.toLowerCase() === 'font-family');
  if (!fontFamily || !fontFamily.value) return false;
  const isMonospace = fontFamily.value.split(',').map(e => e.trim().toLowerCase()).indexOf('monospace') >= 0;
  return isMonospace;
}

rules.indentedCodeBlock = {
  filter: function (node, options) {
    if (options.codeBlockStyle !== 'indented') return false
    if (isCodeBlockSpecialCase1(node) || isCodeBlockSpecialCase2(node)) return true

    return (
      node.nodeName === 'PRE' &&
      node.firstChild &&
      node.firstChild.nodeName === 'CODE'
    )
  },

  replacement: function (content, node, options) {
    const handledNode = isCodeBlockSpecialCase1(node) ? node : node.firstChild

    return (
      '\n\n    ' +
      handledNode.textContent.replace(/\n/g, '\n    ') +
      '\n\n'
    )
  }
}

rules.fencedCodeBlock = {
  filter: function (node, options) {
    if (options.codeBlockStyle !== 'fenced') return false;
    if (isCodeBlockSpecialCase1(node) || isCodeBlockSpecialCase2(node)) return true

    return (
      node.nodeName === 'PRE' &&
      node.firstChild &&
      node.firstChild.nodeName === 'CODE'
    )
  },

  replacement: function (content, node, options) {
    let handledNode = node.firstChild;
    if (isCodeBlockSpecialCase1(node) || isCodeBlockSpecialCase2(node)) handledNode = node;

    var className = handledNode.className || ''
    var language = (className.match(/language-(\S+)/) || [null, ''])[1]

    return (
      '\n\n' + options.fence + language + '\n' +
      handledNode.textContent +
      '\n' + options.fence + '\n\n'
    )
  }
}

rules.horizontalRule = {
  filter: 'hr',

  replacement: function (content, node, options) {
    return '\n\n' + options.hr + '\n\n'
  }
}

function filterLinkContent (content) {
  return content.trim().replace(/[\n\r]+/g, '<br>')
}

function filterLinkHref (href) {
  if (!href) return ''
  href = href.trim()
  if (href.toLowerCase().indexOf('javascript:') === 0) return '' // We don't want to keep js code in the markdown
  // Replace the spaces with %20 because otherwise they can cause problems for some
  // renderer and space is not a valid URL character anyway.
  href = href.replace(/ /g, '%20');
  return href
}

function getNamedAnchorFromLink(node, options) {
  var id = node.getAttribute('id')
  if (!id) id = node.getAttribute('name')
  if (id) id = id.trim();

  if (id && options.anchorNames.indexOf(id.toLowerCase()) >= 0) {
    return '<a id="' + htmlentities(id) + '"></a>';
  } else {
    return '';
  }
}

rules.inlineLink = {
  filter: function (node, options) {
    return (
      options.linkStyle === 'inlined' &&
      node.nodeName === 'A' &&
      (node.getAttribute('href') || node.getAttribute('name') || node.getAttribute('id'))
    )
  },

  replacement: function (content, node, options) {
    var href = filterLinkHref(node.getAttribute('href'))
    if (!href) {
      return getNamedAnchorFromLink(node, options) + filterLinkContent(content)
    } else {
      var title = node.title && node.title !== href ? ' "' + node.title + '"' : ''
      if (!href) title = ''
      return getNamedAnchorFromLink(node, options) + '[' + filterLinkContent(content) + '](' + href + title + ')'
    }
  }
}

// Normally a named anchor would be <a name="something"></a> but
// you can also find <span id="something">Something</span> so the
// rule below handle this.
// Fixes https://github.com/laurent22/joplin/issues/1876
rules.otherNamedAnchors = {
  filter: function (node, options) {
    return !!getNamedAnchorFromLink(node, options);
  },

  replacement: function (content, node, options) {
    return getNamedAnchorFromLink(node, options) + content;
  }
}

rules.referenceLink = {
  filter: function (node, options) {
    return (
      options.linkStyle === 'referenced' &&
      node.nodeName === 'A' &&
      node.getAttribute('href')
    )
  },

  replacement: function (content, node, options) {
    var href = filterLinkHref(node.getAttribute('href'))
    var title = node.title ? ' "' + node.title + '"' : ''
    if (!href) title = ''
    var replacement
    var reference

    content = filterLinkContent(content)

    switch (options.linkReferenceStyle) {
      case 'collapsed':
        replacement = '[' + content + '][]'
        reference = '[' + content + ']: ' + href + title
        break
      case 'shortcut':
        replacement = '[' + content + ']'
        reference = '[' + content + ']: ' + href + title
        break
      default:
        var id = this.references.length + 1
        replacement = '[' + content + '][' + id + ']'
        reference = '[' + id + ']: ' + href + title
    }

    this.references.push(reference)
    return replacement
  },

  references: [],

  append: function (options) {
    var references = ''
    if (this.references.length) {
      references = '\n\n' + this.references.join('\n') + '\n\n'
      this.references = [] // Reset references
    }
    return references
  }
}

rules.emphasis = {
  filter: ['em', 'i'],

  replacement: function (content, node, options) {
    if (!content.trim()) return ''
    return options.emDelimiter + content + options.emDelimiter
  }
}

rules.strong = {
  filter: ['strong', 'b'],

  replacement: function (content, node, options) {
    if (!content.trim()) return ''
    return options.strongDelimiter + content + options.strongDelimiter
  }
}

rules.code = {
  filter: function (node) {
    var hasSiblings = node.previousSibling || node.nextSibling
    var isCodeBlock = node.parentNode.nodeName === 'PRE' && !hasSiblings

    return node.nodeName === 'CODE' && !isCodeBlock
  },

  replacement: function (content) {
    if (!content.trim()) return ''

    var delimiter = '`'
    var leadingSpace = ''
    var trailingSpace = ''
    var matches = content.match(/`+/gm)
    if (matches) {
      if (/^`/.test(content)) leadingSpace = ' '
      if (/`$/.test(content)) trailingSpace = ' '
      while (matches.indexOf(delimiter) !== -1) delimiter = delimiter + '`'
    }

    return delimiter + leadingSpace + content + trailingSpace + delimiter
  }
}

function imageMarkdownFromNode(node, options = null) {
  options = Object.assign({}, {
    preserveImageTagsWithSize: false,
  }, options);

  if (options.preserveImageTagsWithSize && (node.getAttribute('width') || node.getAttribute('height'))) {
    return node.outerHTML;
  }

  var alt = node.alt || ''
  var src = node.getAttribute('src') || ''
  var title = node.title || ''
  var titlePart = title ? ' "' + title + '"' : ''
  return src ? '![' + alt.replace(/([[\]])/g, '\\$1') + ']' + '(' + src + titlePart + ')' : ''
}

function imageUrlFromSource(node) {
  // Format of srcset can be:
  // srcset="kitten.png"
  // or:
  // srcset="kitten.png, kitten@2X.png 2x"

  let src = node.getAttribute('srcset');
  if (!src) src = node.getAttribute('data-srcset');
  if (!src) return '';

  const s = src.split(',');
  if (!s.length) return '';
  src = s[0];

  src = src.split(' ');
  return src[0];
}

rules.image = {
  filter: 'img',

  replacement: function (content, node, options) {
    return imageMarkdownFromNode(node, options);
  }
}

rules.picture = {
  filter: 'picture',

  replacement: function (content, node, options) {
    if (!node.childNodes) return '';

    let firstSource = null;
    let firstImg = null;

    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];

      if (child.nodeName === 'SOURCE' && !firstSource) firstSource = child;
      if (child.nodeName === 'IMG') firstImg = child;
    }

    if (firstImg && firstImg.getAttribute('src')) {
      return imageMarkdownFromNode(firstImg, options);
    } else if (firstSource) {
      // A <picture> tag can have multiple <source> tag and the browser should decide which one to download
      // but for now let's pick the first one.
      const src = imageUrlFromSource(firstSource);
      return src ? '![](' + src + ')' : '';
    }

    return '';
  }
}

function findFirstDescendant(node, byType, name) {
  for (const childNode of node.childNodes) {
    if (byType === 'class' && childNode.classList.contains(name)) return childNode;
    if (byType === 'nodeName' && childNode.nodeName === name) return childNode;

    const sub = findFirstDescendant(childNode, byType, name);
    if (sub) return sub;
  }
  return null;
}

function findParent(node, byType, name) {
  while (true) {
    const p = node.parentNode;
    if (!p) return null;
    if (byType === 'class' && p.classList && p.classList.contains(name)) return p;
    if (byType === 'nodeName' && p.nodeName === name) return p;
    node = p;
  }
}

// ===============================================================================
// MATHJAX support
//
// When encountering Mathjax elements there's first the rendered Mathjax,
// which we want to skip because it cannot be converted reliably to Markdown.
// This tag is followed by the actual MathJax script in a <script> tag, which
// is what we want to export. By wrapping this text in "$" or "$$" it will
// be displayed correctly by Katex in Joplin.
//
// See mathjax_inline and mathjax_block test cases.
// ===============================================================================

function majaxScriptBlockType(node) {
  if (node.nodeName !== 'SCRIPT') return null;

  const a = node.getAttribute('type');
  if (!a || a.indexOf('math/tex') < 0) return null;

  return a.indexOf('display') >= 0 ? 'block' : 'inline';
}

rules.mathjaxRendered = {
  filter: function (node) {
    return node.nodeName === 'SPAN' && node.getAttribute('class') === 'MathJax';
  },

  replacement: function (content, node, options) {
    return '';
  }
}

rules.mathjaxScriptInline = {
  filter: function (node) {
    return majaxScriptBlockType(node) === 'inline';
  },

  escapeContent: function() {
    // We want the raw unescaped content since this is what Katex will need to render
    // If we escape, it will double the \\ in particular.
    return false;
  },

  replacement: function (content, node, options) {
    return '$' + content + '$';
  }
}

rules.mathjaxScriptBlock = {
  filter: function (node) {
    return majaxScriptBlockType(node) === 'block';
  },

  escapeContent: function() {
    return false;
  },

  replacement: function (content, node, options) {
    return '$$\n' + content + '\n$$';
  }
}

// ===============================================================================
// End of MATHJAX support
// ===============================================================================



// ===============================================================================
// Joplin Source block support
// 
// This is specific to Joplin: a plugin may convert some Markdown to HTML
// but keep the original source in a hidden <PRE class="joplin-source"> block.
// In that case, when we convert back again from HTML to MD, we use that
// block for lossless conversion.
// ===============================================================================

function joplinEditableBlockInfo(node) {
  if (!node.classList.contains('joplin-editable')) return null;

  let sourceNode = null;
  for (const childNode of node.childNodes) {
    if (childNode.classList.contains('joplin-source')) {
      sourceNode = childNode;
      break;
    }
  }

  if (!sourceNode) return null;

  return {
    openCharacters: sourceNode.getAttribute('data-joplin-source-open'),
    closeCharacters: sourceNode.getAttribute('data-joplin-source-close'),
    content: sourceNode.textContent,
  };
}

rules.joplinSourceBlock = {
  filter: function (node) {
    return !!joplinEditableBlockInfo(node);
  },

  escapeContent: function() {
    return false;
  },

  replacement: function (content, node, options) {
    const info = joplinEditableBlockInfo(node);
    if (!info) return;

    return info.openCharacters + info.content + info.closeCharacters;
  }
}


// ===============================================================================
// Checkoxes
// ===============================================================================

function joplinCheckboxInfo(liNode) {
  if (liNode.classList.contains('joplin-checkbox')) {
    // Handling of this rendering is buggy as it adds extra new lines between each
    // list item. However, supporting this rendering is normally no longer needed.
    const input = findFirstDescendant(liNode, 'nodeName', 'INPUT');
    return {
      checked: input && input.getAttribute ? !!input.getAttribute('checked') : false,
      renderingType: 1,
    };
  }

  const parentChecklist = findParent(liNode, 'class', 'joplin-checklist');
  if (parentChecklist) {
    return {
      checked: !!liNode.classList && liNode.classList.contains('checked'),
      renderingType: 2,
    };
  }

  return null;
}

export default rules
