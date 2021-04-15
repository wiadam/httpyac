## 2.4.0 (2021-04-11)

#### Features

* better test method support
* refactored response in script to [http response](https://github.com/AnWeber/httpyac/blob/main/src/models/httpResponse.ts) instead of body

## 2.3.1 (2021-04-11)

#### Features

* define response example in http file (ignored in parsing file)
* using chalk for ansi support

#### Fix

* dotenv support accidentally disabled

## 2.3.0 (2021-04-09)

#### Features

* define global script executed after every request
* set ssl client certifcates per request
* intellij syntax support for metadata (`// @no-cookie-jar`)
* markdown utils in httpyac

#### Fix

* priority of config initialization adjusted ([#3](https://github.com/AnWeber/httpyac/issues/3))

## 2.2.1 (2021-04-05)

#### Fix

* minimize size of webpack build

## 2.2.0 (2021-04-05)

#### Feature

* support for ssl client certficates
* note http version (version 1.1 disables http2 support)
* cookiejar support


## 2.1.0 (2021-03-30)

#### Feature

* --version option in cli command

### Fix

* error in signing request with aws

## 2.0.0 (2021-03-27)

#### Feature

* cli support with [httpyac cli](https://www.npmjs.com/package/httpyac)