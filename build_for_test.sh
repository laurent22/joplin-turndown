#!/bin/bash
# ROOT_DIR=/mnt/c/Users/laurent/src/joplin
ROOT_DIR=/home/laurent/source/joplin
CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
set -e
npm run build
# rsync -a ./dist/ $ROOT_DIR/ElectronClient/app/node_modules/joplin-turndown/dist/
# rsync -a ./lib/ $ROOT_DIR/ElectronClient/app/node_modules/joplin-turndown/lib/
rm -rf $ROOT_DIR/CliClient/node_modules/joplin-turndown
ln -s "$CURRENT_DIR" $ROOT_DIR/CliClient/node_modules/joplin-turndown
cd $ROOT_DIR/CliClient && npm run test -- --filter=HtmlToMd