# peerdeps
Peer dependency management.


## Installation
```sh
$ npm i peerdeps -g
```

## Usage
```sh
# Install the peer dependencies cascade defined in package.json/peerDependencies
$ peerdeps i

# Install some packages as peer dependency with save option.
$ peerdeps i pkg1 pkg2 --save
```


## Using peer dependencies like plugins
```sh
$ peerdeps run
```