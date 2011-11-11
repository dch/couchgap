//
//  AppDelegate.h
//  couchgap
//
//  Created by dave on 6/11/11.
//  Copyright __MyCompanyName__ 2011. All rights reserved.
//

#import <UIKit/UIKit.h>
#ifdef PHONEGAP_FRAMEWORK
	#import <PhoneGap/PhoneGapDelegate.h>
#else
	#import "PhoneGapDelegate.h"
#endif

#import <Couchbase/CouchbaseMobile.h>

@interface AppDelegate : PhoneGapDelegate <CouchbaseDelegate> {

	NSString* invokeString;
}

// invoke string is passed to your app on launch, this is only valid if you 
// edit couchgap.plist to add a protocol
// a simple tutorial can be found here : 
// http://iphonedevelopertips.com/cocoa/launching-your-own-application-via-a-custom-url-scheme.html

@property (copy)  NSString* invokeString;

@end

