#!/bin/bash
set -e
# ROOT_DIR=/mnt/c/Users/laurent/src/joplin
# ROOT_DIR=/Users/laurent/src/joplin
ROOT_DIR=/home/laurent/source/joplin
CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
npm run build-for-node
rm -rf $ROOT_DIR/packages/lib/node_modules/joplin-turndown
ln -s "$CURRENT_DIR" $ROOT_DIR/packages/lib/node_modules/joplin-turndown
cd $ROOT_DIR/packages/app-cli && npm run test -- HtmlToMd