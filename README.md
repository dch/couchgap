# CouchGap

Is a work in progress for getting PhoneGap and iOS-Couchbase's build of Apache
CouchDB running together as a single App on iOS devices, with the aim of
providing "JeOS" to run [Couch Apps] fully.

- All you need to get started is Xcode4, git, and an iOS device.
- At the moment, basically it only compiles cleanly.
- "Some functionality may be degraded, or even missing"

## Ground Control to Major Tom

- Install Xcode 4 if you haven't already
- Build and Install latest [PhoneGap iOS] Framework from github

        git clone https://github.com/phonegap/phonegap-iphone.git
        cd phonegap-iphone
        make
        open PhoneGapInstaller.pkg

- continue, continue, install for me only, continue, install, close

# Commencing Countdown

- Get the latest CouchGap bundle from github

        git clone https://dch@github.com/dch/couchgap.git
        cd couchgap
        open couchgap.xcworkspace/

- change the workspace `Identifier` and `Version` to suit
- add more phone fluff if you want to in `www/`

# Engines On

- select scheme `CouchGap | iPhone 4.3 Simulator` or `iOS Device`s
- use apple-R to build and run
- report back on your success, or add some more [issues]

## Release Notes

Please check the [issues] before providing a patch or a suggestion.

## Thanks

- the [CouchDB] community
- Couchbase for sponsoring & pulling [iOS-Couchbase] together
- Nitobi for [PhoneGap]
- mobile-couchbase list & nascent community

## Licence

Apache 2.0 same as CouchDB.

# Building from source

- install the pre-requisites above
- Build the latest [iOS-Couchbase] framework from github

        git clone https://github.com/couchbaselabs/iOS-Couchbase.git --recurse
        open iOS-Couchbase/Couchbase.xcworkspace
        # build TouchJSON-iphonesimulator
        # build TouchJSON-iphoneos
        # build Couchbase-iphonesimulator
        # build Couchbase-iphoneos
        # build Couchbase.bundle

- Check it works by building & running `CouchDemo-iphonesimulator`
- create a new Xcode4 workspace for your app
- create a new project within that based on the PhoneGap template
- update `Identifier` and `Version` as needed

## TODO explain missing voodoo using Marty's Notes

[Issues]: https://github.com/dch/couchgap/issues
[Couch Apps]: http://couchapp.org/
[iOS-Couchbase]: https://github.com/couchbaselabs/iOS-Couchbase
[Couchbase Framework]: https://github.com/couchbaselabs/iOS-Couchbase/file-edit/master/doc/using_mobile_couchbase.md
[CouchGap]: https://github.com/dch/couchgap
[PhoneGap iOS]: https://github.com/phonegap/phonegap-iphone/
[PhoneGap]: http://www.phonegap.com/
[CouchDB]: http://wiki.couchdb.org/
