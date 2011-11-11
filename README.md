################################################################################
# CouchGap
### Bringing the best of the mobile web to iOS devices near you

CouchGap aims to provide an easy-to-use package to support CouchDB CouchApps on
your iOS device, using Callback and Couchbase-iOS.

- the impressive Apache Callback provides the phone-independent layer 
- the awesome Couchbase-iOS mobile framework provides an Xcode bundle of CouchDB

## Pre-requisites

* XCode 4.x or higher
* Callback / PhoneGap 1.2.0 or higher
* Couchbase-iOS 2.0.0-dev or higher

################################################################################
# Set up the Callback workspace and project

create new workspace -> couchgap.cxworkspace
create new project -> couchgap
Product -> Manage Schemes -> change to `Shared`

* Change couchgap/summary/info to:
    
        identifier: de.skunkwerks.couchgap
        version: 0.1
        minimum iOS: 4.0
        
* Select scheme `couchgap | iPhone 4.3 Simulator` & build/run
* You'll get a warning about missing `www/index.html`
* Open the newly created `couchgap/www` folder into your Xcode project
* Build and run again
* You should see an alert "CallBack is working" instead of the warning

################################################################################
# Add the Couchbase iOS framework

* Download the Couchbase framework [CouchBase]
* Unzip into `couchgap/Frameworks/` and drag that into your Xcode Frameworks
* In Xcode's Build Phase `Link Binary with Libraries`, add 3 more libraries:
        
        libstdc++.dylib
        Security.framework
        libz.dylib

* In Xcode's `Run Script` phase add a new script:

        # The 'CouchbaseResources' subfolder of the framework contains
        # resources needed at runtime. Copy it into the app bundle:
        rsync -a "${SRCROOT}/Frameworks/Couchbase.framework/CouchbaseResources" "${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}"
         

################################################################################

# Thanks

- J Chris Anderson
- Marty Schoch
- Alan Lunny
- Max Ogden
- Dale Harvey
- Jens Alfke
- Alexis Hildebrand
- that guy with the tree app ...

[CouchBase]:
[CallBack]:
