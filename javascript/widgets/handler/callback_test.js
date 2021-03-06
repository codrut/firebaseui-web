/*
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the
 * License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Test for callback handler.
 */

goog.provide('firebaseui.auth.widget.handler.CallbackTest');
goog.setTestOnly('firebaseui.auth.widget.handler.CallbackTest');

goog.require('firebaseui.auth.CredentialHelper');
goog.require('firebaseui.auth.PendingEmailCredential');
goog.require('firebaseui.auth.idp');
goog.require('firebaseui.auth.soy2.strings');
goog.require('firebaseui.auth.storage');
goog.require('firebaseui.auth.widget.Config');
goog.require('firebaseui.auth.widget.handler');
goog.require('firebaseui.auth.widget.handler.common');
goog.require('firebaseui.auth.widget.handler.handleCallback');
goog.require('firebaseui.auth.widget.handler.handleEmailMismatch');
goog.require('firebaseui.auth.widget.handler.handleFederatedLinking');
/**
 * @suppress {extraRequire} Required for testing user cancelled error
 *     which can render the federated sign-in page.
 */
goog.require('firebaseui.auth.widget.handler.handleFederatedSignIn');
goog.require('firebaseui.auth.widget.handler.handlePasswordLinking');
/**
 * @suppress {extraRequire} Required for testing when email auth only sign-in is
 *     triggered and accountchooser.com returns an existing password account
 *     which renders the password sign-in page.
 */
goog.require('firebaseui.auth.widget.handler.handlePasswordSignIn');
/**
 * @suppress {extraRequire} Required for testing when email auth only sign-in is
 *     triggered and accountchooser.com returns a new account which renders the
 *     password sign up page.
 */
goog.require('firebaseui.auth.widget.handler.handlePasswordSignUp');
goog.require('firebaseui.auth.widget.handler.handleProviderSignIn');
goog.require('firebaseui.auth.widget.handler.handleSignIn');
goog.require('firebaseui.auth.widget.handler.testHelper');
goog.require('goog.Promise');
goog.require('goog.dom.forms');
goog.require('goog.testing.AsyncTestCase');
goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.jsunit');


var asyncTestCase = goog.testing.AsyncTestCase.createAndInstall();


function testHandleCallback_redirectUser_noPendingCredential() {
  // Test successful return from regular sign in operation.
  asyncTestCase.waitForSignals(1);
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  // User should be signed in at this point.
  testAuth.setUser({
    'email': federatedAccount.getEmail(),
    'displayName': federatedAccount.getDisplayName()
  });
  // Attempting to get redirect result. Resolve with success.
  testAuth.assertGetRedirectResult(
      [],
      {
        'user': testAuth.currentUser,
        'credential': cred
      });
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.setUser(testAuth.currentUser);
    externalAuth.assertSignInWithCredential(
        [cred], externalAuth.currentUser);
    return externalAuth.process();
  }).then(function() {
    // Pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // User should be redirected to success URL.
    testUtil.assertGoTo('http://localhost/home');
    asyncTestCase.signal();
  });
}


function testHandleCallback_signedInUser_noPendingCredential_popup() {
  // Test successful sign in with popup flow.
  asyncTestCase.waitForSignals(1);
  app.updateConfig('signInFlow', 'popup');
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  // User should be signed in.
  testAuth.setUser({
    'email': federatedAccount.getEmail(),
    'displayName': federatedAccount.getDisplayName()
  });
  // Callback rendered with popup result.
  firebaseui.auth.widget.handler.handleCallback(
      app,
      container,
      goog.Promise.resolve({
        'user': testAuth.currentUser,
        'credential': cred
      }));
  assertCallbackPage();
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.setUser(testAuth.currentUser);
    externalAuth.assertSignInWithCredential(
        [cred], externalAuth.currentUser);
    return externalAuth.process();
  }).then(function() {
    // Pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // User should be redirected to success URL.
    testUtil.assertGoTo('http://localhost/home');
    asyncTestCase.signal();
  });
}


function testHandleCallback_reset() {
  asyncTestCase.waitForSignals(1);
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  // Reset current rendered widget.
  app.reset();
  // Container should be cleared.
  assertComponentDisposed();
  // Process all pending promises.
  testAuth.process().then(function() {
    asyncTestCase.signal();
  });
}


function testHandleCallback_redirectUser_noPendingCredential_pendingEmail() {
  // Test successful return from regular sign in operation.
  asyncTestCase.waitForSignals(1);
  var cred  = {
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  };
  // Pending email from a tentative using email and password sign in.
  var pendingEmailCred =
      new firebaseui.auth.PendingEmailCredential(federatedAccount.getEmail());
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  // User should be signed in at this point.
  testAuth.setUser({
    'email': federatedAccount.getEmail(),
    'displayName': federatedAccount.getDisplayName()
  });
  // Attempting to get redirect result. Resolve with success.
  testAuth.assertGetRedirectResult(
      [],
      {
        'user': testAuth.currentUser,
        'credential': cred
      });
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.setUser(testAuth.currentUser);
    externalAuth.assertSignInWithCredential(
        [cred], externalAuth.currentUser);
    return externalAuth.process();
  }).then(function() {
    // Pending credential and email should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // User should be redirected to success URL.
    testUtil.assertGoTo('http://localhost/home');
    asyncTestCase.signal();
  });
}


function testHandleCallback_signedInUser_noPendingCred_pendingEmail_popup() {
  // Test successful sign in operation in popup flow with pending email.
  asyncTestCase.waitForSignals(1);
  app.updateConfig('signInFlow', 'popup');
  var cred  = {
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  };
  // User should be signed in.
  testAuth.setUser({
    'email': federatedAccount.getEmail(),
    'displayName': federatedAccount.getDisplayName()
  });
  // Pending email from a tentative using email and password sign in.
  var pendingEmailCred =
      new firebaseui.auth.PendingEmailCredential(federatedAccount.getEmail());
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered with popup result.
  firebaseui.auth.widget.handler.handleCallback(
      app,
      container,
      goog.Promise.resolve({
        'user': testAuth.currentUser,
        'credential': cred
      }));
  assertCallbackPage();
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.setUser(testAuth.currentUser);
    externalAuth.assertSignInWithCredential(
        [cred], externalAuth.currentUser);
    return externalAuth.process();
  }).then(function() {
    // Pending credential and email should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // User should be redirected to success URL.
    testUtil.assertGoTo('http://localhost/home');
    asyncTestCase.signal();
  });
}


function testHandleCallback_redirectUser_noPendingCredential_emailMismatch() {
  // Test successful return from regular sign in operation.
  asyncTestCase.waitForSignals(1);
  var cred  = {
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  };
  // Pending email from a tentative using email and password sign in.
  var pendingEmailCred =
      new firebaseui.auth.PendingEmailCredential('other@example.com');
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  // User should be signed in at this point.
  testAuth.setUser({
    'email': federatedAccount.getEmail(),
    'displayName': federatedAccount.getDisplayName()
  });
  // Attempting to get redirect result. Resolve with success.
  testAuth.assertGetRedirectResult(
      [],
      {
        'user': testAuth.currentUser,
        'credential': cred
      });
  testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    // Pending email credential should still be here.
    assertTrue(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // User should be redirected to email mismatch page.
    assertEmailMismatchPage(federatedAccount.getEmail(), 'other@example.com');
    asyncTestCase.signal();
  });
}


function testHandleCallback_signedInUser_noPendingCred_emailMismatch_popup() {
  // Test successful sign in operation in popup flow when email mismatch is
  // detected in linking.
  asyncTestCase.waitForSignals(1);
  app.updateConfig('signInFlow', 'popup');
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  // User should be signed in.
  testAuth.setUser({
    'email': federatedAccount.getEmail(),
    'displayName': federatedAccount.getDisplayName()
  });
  // Pending email from a tentative using email and password sign in.
  var pendingEmailCred =
      new firebaseui.auth.PendingEmailCredential('other@example.com');
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered with popup result.
  firebaseui.auth.widget.handler.handleCallback(
      app,
      container,
      goog.Promise.resolve({
        'user': testAuth.currentUser,
        'credential': cred
      }));
  assertCallbackPage();
  testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    // Pending email credential should still be here.
    assertTrue(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // User should be redirected to email mismatch page.
    assertEmailMismatchPage(federatedAccount.getEmail(), 'other@example.com');
    asyncTestCase.signal();
  });
}


function testHandleCallback_redirectUser_emailMismatch_providerEmailMatch() {
  // Test successful return from regular sign in operation.
  asyncTestCase.waitForSignals(1);
  var cred  = {
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  };
  // Pending email from a tentative email/password sign in.
  var pendingEmailCred =
      new firebaseui.auth.PendingEmailCredential('other@example.com');
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  // User should be signed in at this point.
  testAuth.setUser({
    'email': federatedAccount.getEmail(),
    'displayName': federatedAccount.getDisplayName(),
    'providerData': [
      {
        'providerId': 'google.com',
        'email': 'other@example.com'
      },{
        'providerId': 'facebook.com',
        'email': 'another@example.com'
      }
    ]
  });
  // Attempting to get redirect result. Resolve with success.
  testAuth.assertGetRedirectResult(
      [],
      {
        'user': testAuth.currentUser,
        'credential': cred
      });
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.setUser(testAuth.currentUser);
    externalAuth.assertSignInWithCredential(
        [cred], externalAuth.currentUser);
    return externalAuth.process();
  }).then(function() {
    // Pending credential and email should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // User should be redirected to success URL.
    testUtil.assertGoTo('http://localhost/home');
    asyncTestCase.signal();
  });
}


function testHandleCallback_redirectUser_noPendingCredential_signInCallback() {
  // Test successful return from regular sign in operation. Test when sign in
  // callback is provided, auth credential is passed.
  asyncTestCase.waitForSignals(1);
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  // Set config sign in success callback with false return value.
  app.setConfig({
    'callbacks': {
      'signInSuccess': signInSuccessCallback(false)
    }
  });
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  // User should be signed in at this point.
  testAuth.setUser({
    'email': federatedAccount.getEmail(),
    'displayName': federatedAccount.getDisplayName()
  });
  // Attempting to get redirect result. Resolve with success.
  testAuth.assertGetRedirectResult(
      [],
      {
        'user': testAuth.currentUser,
        'credential': cred
      });
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.setUser(testAuth.currentUser);
    externalAuth.assertSignInWithCredential(
        [cred], externalAuth.currentUser);
    return externalAuth.process();
  }).then(function() {
    // Pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // Sign in callback should be triggered. SignInCallback is called.
    assertSignInSuccessCallbackInvoked(
        externalAuth.currentUser,
        cred,
        undefined);
    // Container should be cleared.
    assertComponentDisposed();
    asyncTestCase.signal();
  });
}


function testHandleCallback_redirectUser_pendingCredential_success() {
  // Test successful return from regular sign in operation with pending
  // credentials requiring linking.
  asyncTestCase.waitForSignals(1);
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail(), cred);
  // Simulate previous linking required (pending credentials should be saved).
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  // User should be signed in at this point.
  testAuth.setUser({
    'email': federatedAccount.getEmail(),
    'displayName': federatedAccount.getDisplayName()
  });
  // Attempting to get redirect result. Resolve with success.
  testAuth.assertGetRedirectResult(
      [],
      {
        'user': testAuth.currentUser,
        'credential': null
      });
  testAuth.process().then(function() {
    // Linking should be triggered with pending credential.
    testAuth.currentUser.assertLink([cred], testAuth.currentUser);
    return testAuth.process();
    // Sign out from internal instance and then sign in with passed credential
    // to external instance.
  }).then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.setUser(testAuth.currentUser);
    externalAuth.assertSignInWithCredential(
        [cred], externalAuth.currentUser);
    return externalAuth.process();
  }).then(function() {
    // Pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // User should be redirected to success URL.
    testUtil.assertGoTo('http://localhost/home');
    asyncTestCase.signal();
  });
}


function testHandleCallback_signedInUser_pendingCredential_success_popup() {
  // Test successful sign in operation in popup flow with pending credentials
  // requiring linking.
  asyncTestCase.waitForSignals(1);
  app.updateConfig('signInFlow', 'popup');
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  // User should be signed in.
  testAuth.setUser({
    'email': federatedAccount.getEmail(),
    'displayName': federatedAccount.getDisplayName()
  });
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail(), cred);
  // Simulate previous linking required (pending credentials should be saved).
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered with popup result.
  firebaseui.auth.widget.handler.handleCallback(
      app,
      container,
      goog.Promise.resolve({
        'user': testAuth.currentUser,
        'credential': null
      }));
  assertCallbackPage();
  testAuth.process().then(function() {
    // Linking should be triggered with pending credential.
    testAuth.currentUser.assertLink([cred], testAuth.currentUser);
    return testAuth.process();
    // Sign out from internal instance and then sign in with passed credential
    // to external instance.
  }).then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.setUser(testAuth.currentUser);
    externalAuth.assertSignInWithCredential(
        [cred], externalAuth.currentUser);
    return externalAuth.process();
  }).then(function() {
    // Pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // User should be redirected to success URL.
    testUtil.assertGoTo('http://localhost/home');
    asyncTestCase.signal();
  });
}


function testHandleCallback_redirectUser_pendingCredential_signInCallback() {
  // Test successful return from regular sign in operation with pending
  // credentials requiring linking. Test when sign in callback is provided, auth
  // credential is passed.
  asyncTestCase.waitForSignals(1);
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail(), cred);
  // Set config sign in success callback with false return value.
  app.setConfig({
    'callbacks': {
      'signInSuccess': signInSuccessCallback(false)
    }
  });
  // Simulate previous linking required (pending credentials should be saved).
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  // User should be signed in at this point.
  testAuth.setUser({
    'email': federatedAccount.getEmail(),
    'displayName': federatedAccount.getDisplayName()
  });
  // Attempting to get redirect result. Resolve with success.
  testAuth.assertGetRedirectResult(
      [],
      {
        'user': testAuth.currentUser,
        'credential': null
      });
  testAuth.process().then(function() {
    // Linking should be triggered with pending credential.
    testAuth.currentUser.assertLink([cred], testAuth.currentUser);
    return testAuth.process();
    // Sign out from internal instance and then sign in with passed credential
    // to external instance.
  }).then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.setUser(testAuth.currentUser);
    externalAuth.assertSignInWithCredential(
        [cred], externalAuth.currentUser);
    return externalAuth.process();
  }).then(function() {
    // Pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // Sign in callback should be triggered.
    assertSignInSuccessCallbackInvoked(
        externalAuth.currentUser,
        cred,
        undefined);
    // Container should be cleared.
    assertComponentDisposed();
    asyncTestCase.signal();
  });
}


function testHandleCallback_redirectUser_pendingCredential_emailMismatch() {
  // Test successful return from regular sign in operation.
  asyncTestCase.waitForSignals(1);
  var pendingCred  = {
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  };
  var cred  = {
    'provider': 'google.com',
    'accessToken': 'OTHER_ACCESS_TOKEN'
  };
  // Pending email from a tentative federated sign-in.
  var pendingEmailCred =
      new firebaseui.auth.PendingEmailCredential('other@example.com',
          pendingCred);
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  // User should be signed in at this point.
  testAuth.setUser({
    'email': federatedAccount.getEmail(),
    'displayName': federatedAccount.getDisplayName()
  });
  // Attempting to get redirect result. Resolve with success.
  testAuth.assertGetRedirectResult(
      [],
      {
        'user': testAuth.currentUser,
        'credential': cred
      });
  testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    // Pending email credential should still be here.
    assertTrue(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // User should be redirected to success URL.
    assertEmailMismatchPage(federatedAccount.getEmail(), 'other@example.com');
    asyncTestCase.signal();
  });
}


function testHandleCallback_signedInUser_pendingCred_emailMismatch_popup() {
  // Test successful sign in operation in popup flow with pending credential
  // triggering mismatch.
  asyncTestCase.waitForSignals(1);
  app.updateConfig('signInFlow', 'popup');
  var pendingCred  = {
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  };
  var cred  = {
    'provider': 'google.com',
    'accessToken': 'OTHER_ACCESS_TOKEN'
  };
  // User should be signed in.
  testAuth.setUser({
    'email': federatedAccount.getEmail(),
    'displayName': federatedAccount.getDisplayName()
  });
  // Pending email from a tentative federated sign-in.
  var pendingEmailCred =
      new firebaseui.auth.PendingEmailCredential('other@example.com',
          pendingCred);
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered with popup result.
  firebaseui.auth.widget.handler.handleCallback(
      app,
      container,
      goog.Promise.resolve({
        'user': testAuth.currentUser,
        'credential': cred
      }));
  assertCallbackPage();
  testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    // Pending email credential should still be here.
    assertTrue(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // User should be redirected to success URL.
    assertEmailMismatchPage(federatedAccount.getEmail(), 'other@example.com');
    asyncTestCase.signal();
  });
}


function testHandleCallback_redirectUser_pendingCredential_error() {
  // Test return from regular sign in operation with pending credentials
  // requiring linking. Simulate error in linking.
  asyncTestCase.waitForSignals(1);
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail(), cred);
  // Simulate previous linking required (pending credentials should be saved).
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  // User should be signed in at this point.
  testAuth.setUser({
    'email': federatedAccount.getEmail(),
    'displayName': federatedAccount.getDisplayName()
  });
  // Attempting to get redirect result. Resolve with success.
  testAuth.assertGetRedirectResult(
      [],
      {
        'user': testAuth.currentUser,
        'credential': null
      });
  testAuth.process().then(function() {
    // Linking should be triggered with pending credential.
    // Simulate an error here.
    testAuth.currentUser.assertLink([cred], null, internalError);
    return testAuth.process();
  }).then(function() {
    // Pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // Redirect to the provider's sign-in page.
    assertProviderSignInPage();
    // Show error in info bar.
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(internalError));
    asyncTestCase.signal();
  });
}


function testHandleCallback_signedInUser_pendingCred_error_popup() {
  // Test sign in operation with pending credentials requiring linking in popup
  // flow. Simulate error in linking.
  asyncTestCase.waitForSignals(1);
  app.updateConfig('signInFlow', 'popup');
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  // User should be signed in.
  testAuth.setUser({
    'email': federatedAccount.getEmail(),
    'displayName': federatedAccount.getDisplayName()
  });
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail(), cred);
  // Simulate previous linking required (pending credentials should be saved).
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered with popup result.
  firebaseui.auth.widget.handler.handleCallback(
      app,
      container,
      goog.Promise.resolve({
        'user': testAuth.currentUser,
        'credential': null
      }));
  assertCallbackPage();
  testAuth.process().then(function() {
    // Linking should be triggered with pending credential.
    // Simulate an error here.
    testAuth.currentUser.assertLink([cred], null, internalError);
    return testAuth.process();
  }).then(function() {
    // Pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // Redirect to the provider's sign-in page.
    assertProviderSignInPage();
    // Show error in info bar.
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(internalError));
    asyncTestCase.signal();
  });
}


function testHandleCallback_redirectUser_pendingCredential_err_emailAuthOnly() {
  // Test return from regular sign in operation with pending credentials
  // requiring linking. Simulate error in linking.
  // Test when single email auth provider is used.
  asyncTestCase.waitForSignals(1);
  app.setConfig({
    'credentialHelper': firebaseui.auth.CredentialHelper.ACCOUNT_CHOOSER_COM,
    'signInOptions': [firebase.auth.EmailAuthProvider.PROVIDER_ID]
  });
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail(), cred);
  // Simulate previous linking required (pending credentials should be saved).
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  // User should be signed in at this point.
  testAuth.setUser({
    'email': federatedAccount.getEmail(),
    'displayName': federatedAccount.getDisplayName()
  });
  // Attempting to get redirect result. Resolve with success.
  testAuth.assertGetRedirectResult(
      [],
      {
        'user': testAuth.currentUser,
        'credential': null
      });
  testAuth.process().then(function() {
    // Linking should be triggered with pending credential.
    // Simulate an error here.
    testAuth.currentUser.assertLink([cred], null, internalError);
    return testAuth.process();
  }).then(function() {
    // Pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // Redirect to the sign-in page.
    assertSignInPage();
    // Show error in info bar.
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(internalError));
    asyncTestCase.signal();
  });
}


function testHandleCallback_signedInUser_pendingCred_err_emailAuthOnly_popup() {
  // Test sign in operation with pending credentials requiring linking in popup
  // flow. Simulate error in linking.
  // Test when single email auth provider is used.
  asyncTestCase.waitForSignals(1);
  app.updateConfig('signInFlow', 'popup');
  app.setConfig({
    'credentialHelper': firebaseui.auth.CredentialHelper.ACCOUNT_CHOOSER_COM,
    'signInOptions': [firebase.auth.EmailAuthProvider.PROVIDER_ID]
  });
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  // User should be signed in.
  testAuth.setUser({
    'email': federatedAccount.getEmail(),
    'displayName': federatedAccount.getDisplayName()
  });
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail(), cred);
  // Simulate previous linking required (pending credentials should be saved).
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered with popup result.
  firebaseui.auth.widget.handler.handleCallback(
      app,
      container,
      goog.Promise.resolve({
        'user': testAuth.currentUser,
        'credential': null
      }));
  assertCallbackPage();
  testAuth.process().then(function() {
    // Linking should be triggered with pending credential.
    // Simulate an error here.
    testAuth.currentUser.assertLink([cred], null, internalError);
    return testAuth.process();
  }).then(function() {
    // Pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // Redirect to the sign-in page.
    assertSignInPage();
    // Show error in info bar.
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(internalError));
    asyncTestCase.signal();
  });
}


function testHandleCallback_redirectError_noLinking() {
  // Test return from regular sign in operation with some non linking error.
  asyncTestCase.waitForSignals(1);
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  // Attempting to get redirect result. Reject with a generic error.
  testAuth.assertGetRedirectResult([], null, internalError);
  testAuth.process().then(function() {
    // Any pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // Redirect to the provider's sign-in page.
    assertProviderSignInPage();
    // Show error in info bar.
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(internalError));
    asyncTestCase.signal();
  });
}


function testHandleCallback_signInError_noLinking_popup() {
  // Test sign in operation with some non linking error in popup flow.
  asyncTestCase.waitForSignals(1);
  app.updateConfig('signInFlow', 'popup');
  // Attempting to get redirect result. Reject with a generic error.
  // Callback rendered with popup result.
  firebaseui.auth.widget.handler.handleCallback(
      app,
      container,
      goog.Promise.reject(internalError));
  assertCallbackPage();
  testAuth.process().then(function() {
    // Any pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // Redirect to the provider's sign-in page.
    assertProviderSignInPage();
    // Show error in info bar.
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(internalError));
    asyncTestCase.signal();
  });
}


function testHandleCallback_redirectError_noLinking_emailAuthOnly() {
  // Test return from regular sign in operation with some non linking error.
  // Test when single email auth provider is used.
  asyncTestCase.waitForSignals(1);
  app.setConfig({
    'credentialHelper': firebaseui.auth.CredentialHelper.ACCOUNT_CHOOSER_COM,
    'signInOptions': [firebase.auth.EmailAuthProvider.PROVIDER_ID]
  });
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  // Attempting to get redirect result. Reject with a generic error.
  testAuth.assertGetRedirectResult([], null, internalError);
  testAuth.process().then(function() {
    // Any pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // Redirect to the sign-in page.
    assertSignInPage();
    // Show error in info bar.
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(internalError));
    asyncTestCase.signal();
  });
}


function testHandleCallback_signInError_noLinking_emailAuthOnly_popup() {
  // Test sign in operation with some non linking error in popup flow.
  // Test when single email auth provider is used.
  asyncTestCase.waitForSignals(1);
  app.setConfig({
    'signInFlow': 'popup',
    'credentialHelper': firebaseui.auth.CredentialHelper.ACCOUNT_CHOOSER_COM,
    'signInOptions': [firebase.auth.EmailAuthProvider.PROVIDER_ID]
  });
  // Popup result: reject with a generic error.
  // Callback rendered with popup result.
  firebaseui.auth.widget.handler.handleCallback(
      app, container, goog.Promise.reject(internalError));
  assertCallbackPage();
  testAuth.process().then(function() {
    // Any pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // Redirect to the sign-in page.
    assertSignInPage();
    // Show error in info bar.
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(internalError));
    asyncTestCase.signal();
  });
}


function testHandleCallback_redirectError_passwordLinkingRequired() {
  // Test return from regular sign in operation with a linking error.
  // Pending credential should be saved and password linking page rendered.
  asyncTestCase.waitForSignals(1);
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  });

  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  // Attempting to get redirect result. Reject with an error requiring linking.
  // The error contains the email and the pending credential.
  testAuth.assertGetRedirectResult(
      [],
      null,
      {
        'code': 'auth/account-exists-with-different-credential',
        'email': passwordAccount.getEmail(),
        'credential': cred
      });
  testAuth.assertFetchProvidersForEmail(
      [federatedAccount.getEmail()], ['password']);
  testAuth.process().then(function() {
    // The pending email credential should be cleared at this point.
    // Password linking does not require a redirect so no need to save it
    // anyway.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    assertPasswordLinkingPage(federatedAccount.getEmail());
    asyncTestCase.signal();
  });
}


function testHandleCallback_redirectError_anonymousLinkingRequired() {
  // Test return from regular sign in operation with a linking error to an
  // anonymous user. fetchProvidersForEmail would return an empty array.
  // Password recovery should be shown.
  asyncTestCase.waitForSignals(1);
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'github.com',
    'accessToken': 'ACCESS_TOKEN'
  });

  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  // Attempting to get redirect result. Reject with an error requiring linking.
  // The error contains the email and the pending credential.
  testAuth.assertGetRedirectResult(
      [],
      null,
      {
        'code': 'auth/account-exists-with-different-credential',
        'email': passwordAccount.getEmail(),
        'credential': cred
      });
  // As the email exists on an anonymous account. This will resolve with an
  // empty array.
  testAuth.assertFetchProvidersForEmail(
      [federatedAccount.getEmail()], []);
  testAuth.process().then(function() {
    // The pending email credential should be cleared at this point.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // Password recovery page should be rendered with correct info bar message.
    assertPasswordRecoveryPage();
    // Info bar message should be shown.
    assertInfoBarMessage(
        firebaseui.auth.soy2.strings.errorAnonymousEmailBlockingSignIn()
          .toString());
    asyncTestCase.signal();
  });
}


function testHandleCallback_signInError_passwordLinkingRequired_popup() {
  // Test sign in operation with a linking error in popup flow.
  // Pending credential should be saved and password linking page rendered.
  asyncTestCase.waitForSignals(1);
  app.updateConfig('signInFlow', 'popup');
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  });

  // Callback rendered with popup result.
  firebaseui.auth.widget.handler.handleCallback(
      app,
      container,
      goog.Promise.reject({
        'code': 'auth/account-exists-with-different-credential',
        'email': passwordAccount.getEmail(),
        'credential': cred
      }));
  assertCallbackPage();
  testAuth.assertFetchProvidersForEmail(
      [federatedAccount.getEmail()], ['password']);
  testAuth.process().then(function() {
    // The pending email credential should be cleared at this point.
    // Password linking does not require a redirect so no need to save it
    // anyway.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    assertPasswordLinkingPage(federatedAccount.getEmail());
    asyncTestCase.signal();
  });
}


function testHandleCallback_redirectError_federatedLinkingRequired() {
  // Test return from regular sign in operation with a linking error.
  // Pending credential should be saved and federated linking page rendered.
  asyncTestCase.waitForSignals(1);
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail(), cred);
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  // Attempting to get redirect result. Reject with an error requiring linking.
  // The error contains the email and the pending credential.
  testAuth.assertGetRedirectResult(
      [],
      null,
      {
        'code': 'auth/account-exists-with-different-credential',
        'email': federatedAccount.getEmail(),
        'credential': cred
      });
  testAuth.assertFetchProvidersForEmail(
      [federatedAccount.getEmail()], ['google.com']);
  testAuth.process().then(function() {
    // The pending credential should be saved here.
    assertObjectEquals(
        pendingEmailCred,
        firebaseui.auth.storage.getPendingEmailCredential(app.getAppId()));
    assertFederatedLinkingPage(federatedAccount.getEmail());
    asyncTestCase.signal();
  });
}


function testHandleCallback_signInError_federatedLinkingRequired_popup() {
  // Test sign in operation with a linking error in popup flow.
  // Pending credential should be saved and federated linking page rendered.
  asyncTestCase.waitForSignals(1);
  app.updateConfig('signInFlow', 'popup');
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail(), cred);
  // Callback rendered with popup result.
  firebaseui.auth.widget.handler.handleCallback(
      app,
      container,
      goog.Promise.reject({
        'code': 'auth/account-exists-with-different-credential',
        'email': federatedAccount.getEmail(),
        'credential': cred
      }));
  assertCallbackPage();
  testAuth.assertFetchProvidersForEmail(
      [federatedAccount.getEmail()], ['google.com']);
  testAuth.process().then(function() {
    // The pending credential should be saved here.
    assertObjectEquals(
        pendingEmailCred,
        firebaseui.auth.storage.getPendingEmailCredential(app.getAppId()));
    assertFederatedLinkingPage(federatedAccount.getEmail());
    asyncTestCase.signal();
  });
}


function testHandleCallback_redirectError_linkingRequired_error() {
  // Test return from regular sign in operation with a linking error.
  // Fetch Provider Email request fails in this case.
  asyncTestCase.waitForSignals(1);
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'facebook.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  // Attempting to get redirect result. Reject with an error requiring linking.
  // The error contains the email and the pending credential.
  testAuth.assertGetRedirectResult(
      [],
      null,
      {
        'code': 'auth/account-exists-with-different-credential',
        'email': federatedAccount.getEmail(),
        'credential': cred
      });
  // This request fails so we are unable to determine what provider to use.
  testAuth.assertFetchProvidersForEmail(
      [federatedAccount.getEmail()], null, internalError);
  testAuth.process().then(function() {
    // Any pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // Redirect to the provider's sign-in page.
    assertProviderSignInPage();
    // Show error in info bar.
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(internalError));
    asyncTestCase.signal();
  });
}


function testHandleCallback_signInError_linkingRequired_error_popup() {
  // Test sign in operation with a linking error in popup flow.
  // Fetch Provider Email request fails in this case.
  asyncTestCase.waitForSignals(1);
  app.updateConfig('signInFlow', 'popup');
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'facebook.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  // Callback rendered with popup result.
  firebaseui.auth.widget.handler.handleCallback(
      app,
      container,
      goog.Promise.reject({
        'code': 'auth/account-exists-with-different-credential',
        'email': federatedAccount.getEmail(),
        'credential': cred
      }));
  assertCallbackPage();
  // This request fails so we are unable to determine what provider to use.
  testAuth.assertFetchProvidersForEmail(
      [federatedAccount.getEmail()], null, internalError);
  testAuth.process().then(function() {
    // Any pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // Redirect to the provider's sign-in page.
    assertProviderSignInPage();
    // Show error in info bar.
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(internalError));
    asyncTestCase.signal();
  });
}


function testHandleCallback_redirectError_linkingRequired_err_emailAuthOnly() {
  // Test return from regular sign in operation with a linking error.
  // Fetch Provider Email request fails in this case.
  // Test when single email auth provider is used.
  app.setConfig({
    'credentialHelper': firebaseui.auth.CredentialHelper.ACCOUNT_CHOOSER_COM,
    'signInOptions': [firebase.auth.EmailAuthProvider.PROVIDER_ID]
  });
  asyncTestCase.waitForSignals(1);
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'facebook.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  // Attempting to get redirect result. Reject with an error requiring linking.
  // The error contains the email and the pending credential.
  testAuth.assertGetRedirectResult(
      [],
      null,
      {
        'code': 'auth/account-exists-with-different-credential',
        'email': federatedAccount.getEmail(),
        'credential': cred
      });
  // This request fails so we are unable to determine what provider to use.
  testAuth.assertFetchProvidersForEmail(
      [federatedAccount.getEmail()], null, internalError);
  testAuth.process().then(function() {
    // Any pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // Redirect to the sign-in page.
    assertSignInPage();
    // Show error in info bar.
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(internalError));
    asyncTestCase.signal();
  });
}


function testHandleCallback_signInErr_linkRequired_err_emailAuthOnly_popup() {
  // Test sign in operation with a linking error in popup flow.
  // Fetch Provider Email request fails in this case.
  // Test when single email auth provider is used.
  app.setConfig({
    'credentialHelper': firebaseui.auth.CredentialHelper.ACCOUNT_CHOOSER_COM,
    'signInOptions': [firebase.auth.EmailAuthProvider.PROVIDER_ID]
  });
  asyncTestCase.waitForSignals(1);
  app.updateConfig('signInFlow', 'popup');
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'facebook.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  // Callback rendered with popup result.
  firebaseui.auth.widget.handler.handleCallback(
      app,
      container,
      goog.Promise.reject({
        'code': 'auth/account-exists-with-different-credential',
        'email': federatedAccount.getEmail(),
        'credential': cred
      }));
  assertCallbackPage();
  // This request fails so we are unable to determine what provider to use.
  testAuth.assertFetchProvidersForEmail(
      [federatedAccount.getEmail()], null, internalError);
  testAuth.process().then(function() {
    // Any pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // Redirect to the sign-in page.
    assertSignInPage();
    // Show error in info bar.
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(internalError));
    asyncTestCase.signal();
  });
}


function testHandleCallback_redirectError_userCancelled_passwordCredential() {
  asyncTestCase.waitForSignals(1);
  // Saves the email the user originally used to try to sign in.
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail());
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Attempting to get redirect result. Reject with the user cancelled error.
  var userCancelledError = {
    'code': 'auth/user-cancelled'
  };
  testAuth.assertGetRedirectResult([], null, userCancelledError);
  // It has to fetch providers to know what provider to use for linking.
  testAuth.assertFetchProvidersForEmail(
      [federatedAccount.getEmail()], ['google.com']);
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  testAuth.process().then(function() {
    // Redirects to the federated sign-in page.
    assertFederatedLinkingPage(federatedAccount.getEmail());
    // Still has pending credential.
    assertTrue(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // Show error in info bar.
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(
            userCancelledError));
    asyncTestCase.signal();
  });
}


function testHandleCallback_redirectError_userCancelled_federatedCredential() {
  asyncTestCase.waitForSignals(1);
  // Saves the credential the user originally used to try to sign in.
  var cred  = firebaseui.auth.idp.getAuthCredential({
    'provider': 'facebook.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail(), cred);
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Attempting to get redirect result. Reject with the user cancelled error.
  var userCancelledError = {
    'code': 'auth/user-cancelled'
  };
  testAuth.assertGetRedirectResult([], null, userCancelledError);
  // It has to fetch providers to know what provider to use for linking.
  testAuth.assertFetchProvidersForEmail(
      [federatedAccount.getEmail()], ['google.com']);
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  testAuth.process().then(function() {
    // Redirects to Federated Linking page.
    assertFederatedLinkingPage(federatedAccount.getEmail());
    // Still has pending credential.
    assertTrue(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // Show error in info bar.
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(
            userCancelledError));
    asyncTestCase.signal();
  });
}


function testHandleCallback_redirectError_userCancelled_noPendingCredential() {
  asyncTestCase.waitForSignals(1);
  // Attempting to get redirect result. Reject with the user cancelled error.
  var userCancelledError = {
    'code': 'auth/user-cancelled'
  };
  testAuth.assertGetRedirectResult([], null, userCancelledError);
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  testAuth.process().then(function() {
    // Redirects to the federated sign-in page.
    assertProviderSignInPage();
    // Show error in info bar.
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(
            userCancelledError));
    asyncTestCase.signal();
  });
}


function testHandleCallback_nullUser() {
  // Test when no previous sign-in with redirect is detected and provider sign
  // in page is rendered.
  asyncTestCase.waitForSignals(1);
  // Set some pending email to ensure they're deleted after.
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail());
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  testAuth.setUser(null);
  // Attempting to get redirect result. Resolve with empty result (no previous
  // redirect).
  testAuth.assertGetRedirectResult(
      [],
      {
        'user': null,
        'credential': null
      });
  testAuth.process().then(function() {
    // Redirect to provider sign-in page with no error message.
    assertProviderSignInPage();
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    asyncTestCase.signal();
  });
}


function testHandleCallback_nullUser_emailAuthOnly_acEnabled() {
  // Test when no previous sign-in with redirect is detected and the sign-in
  // page is rendered (email auth provider only, accountchooser.com is enabled).
  app.setConfig({
    'credentialHelper': firebaseui.auth.CredentialHelper.ACCOUNT_CHOOSER_COM,
    'signInOptions': [firebase.auth.EmailAuthProvider.PROVIDER_ID]
  });
  asyncTestCase.waitForSignals(1);
  // Simulate empty response from accountchooser.com click.
  testAc.setSkipSelect(true);
  // Set some pending email to ensure they're deleted after.
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail());
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  testAuth.setUser(null);
  // Attempting to get redirect result. Resolve with empty result (no previous
  // redirect).
  testAuth.assertGetRedirectResult(
      [],
      {
        'user': null,
        'credential': null
      });
  testAuth.process().then(function() {
    // This should redirect to the sign-in widget.
    // Try select should be called.
    testAc.assertTrySelectAccount(
        firebaseui.auth.storage.getRememberedAccounts(app.getAppId()),
        'http://localhost/firebaseui-widget?mode=select');
    // The sign-in page should show.
    assertSignInPage();
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    asyncTestCase.signal();
  });
}


function testHandleCallback_nullUser_emailAuthOnly_acEnabled_newAcctSelect() {
  // Test when no previous sign-in with redirect is detected and the sign-in
  // page is rendered (email auth provider only, accountchooser.com is enabled).
  // Simulate new account selected.
  app.setConfig({
    'credentialHelper': firebaseui.auth.CredentialHelper.ACCOUNT_CHOOSER_COM,
    'signInOptions': [firebase.auth.EmailAuthProvider.PROVIDER_ID],
    'callbacks': {
      'accountChooserResult': accountChooserResultCallback,
      'accountChooserInvoked': accountChooserInvokedCallback,
      'uiShown': uiShownCallback
    }
  });
  asyncTestCase.waitForSignals(1);
  // Simulate password account selected from accountchooser.com.
  testAc.setSelectedAccount(passwordAccount);
  // Set some pending email to ensure they're deleted after.
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail());
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  testAuth.setUser(null);
  // Attempting to get the redirect result. Resolve with empty result (no
  // previous redirect).
  testAuth.assertGetRedirectResult(
      [],
      {
        'user': null,
        'credential': null
      });
  testAuth.process().then(function() {
    // No pending accountchooser.com response which will trigger try select.
    testAc.forceOnEmpty();
    // Confirm accountChooserInvoked is called and run on continue function.
    assertAndRunAccountChooserInvokedCallback();
    // Account selection logged.
    assertAndRunAccountChooserResultCallback('accountSelected');
    // New account selected will trigger password sign up flow.
    testAuth.assertFetchProvidersForEmail(
        [passwordAccount.getEmail()],
        []);
    return testAuth.process();
  }).then(function() {
    // New password account should be treated as password sign-up in
    // provider first display mode.
    assertPasswordSignUpPage();
    // After accountchooser.com redirects and the password sign-up page renders,
    // uiShown should be called.
    assertEquals(uiShownCallbackCount, 1);
    // New account selected, should trigger password sign up.
    assertEquals(
        passwordAccount.getEmail(),
        goog.dom.forms.getValue(getEmailElement()));
    assertEquals(
        passwordAccount.getDisplayName(),
        goog.dom.forms.getValue(getNameElement()));
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    asyncTestCase.signal();
  });
}


function testHandleCallback_nullUser_emailAuthOnly_acEnabled_existingAccount() {
  // Test when no previous sign-in with redirect is detected and the sign-in
  // page is rendered (email auth provider only, accountchooser.com is enabled).
  // Simulate existing password account selected.
  app.setConfig({
    'credentialHelper': firebaseui.auth.CredentialHelper.ACCOUNT_CHOOSER_COM,
    'signInOptions': [firebase.auth.EmailAuthProvider.PROVIDER_ID],
    'callbacks': {
      'accountChooserResult': accountChooserResultCallback,
      'accountChooserInvoked': accountChooserInvokedCallback,
      'uiShown': uiShownCallback
    }
  });
  asyncTestCase.waitForSignals(1);
  // Simulate password account selected from accountchooser.com.
  testAc.setSelectedAccount(passwordAccount);
  // Set some pending email to ensure they're deleted after.
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail());
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  testAuth.setUser(null);
  // Attempting to get redirect result. Resolve with empty result (no previous
  // redirect).
  testAuth.assertGetRedirectResult(
      [],
      {
        'user': null,
        'credential': null
      });
  testAuth.process().then(function() {
    // No pending accountchooser.com response which will trigger try select.
    testAc.forceOnEmpty();
    // Confirm accountChooserInvoked is called and run on continue function.
    assertAndRunAccountChooserInvokedCallback();
    // Account selection logged.
    assertAndRunAccountChooserResultCallback('accountSelected');
    // Existing password account selected will trigger password sign in flow.
    testAuth.assertFetchProvidersForEmail(
        [passwordAccount.getEmail()],
        ['password']);
    return testAuth.process();
  }).then(function() {
    // Existing password account should trigger password sign in.
    assertPasswordSignInPage();
    // After accountchooser.com redirects and the password sign-in page renders,
    // uiShown should be called.
    assertEquals(uiShownCallbackCount, 1);
    assertEquals(
        passwordAccount.getEmail(),
        goog.dom.forms.getValue(getEmailElement()));
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    asyncTestCase.signal();
  });
}


function testHandleCallback_nullUser_emailAuthOnly_acEnabled_addAccount() {
  // Test when no previous sign-in with redirect is detected and the sign-in
  // page is rendered (email auth provider only, accountchooser.com is enabled).
  // Simulate "Add Account" selected.
  app.setConfig({
    'credentialHelper': firebaseui.auth.CredentialHelper.ACCOUNT_CHOOSER_COM,
    'signInOptions': [firebase.auth.EmailAuthProvider.PROVIDER_ID],
    'callbacks': {
      'accountChooserResult': accountChooserResultCallback,
      'accountChooserInvoked': accountChooserInvokedCallback,
      'uiShown': uiShownCallback
    }
  });
  asyncTestCase.waitForSignals(1);
  // Simulate add account in accountchooser.com click.
  testAc.setAddAccount();
  // Set some pending email to ensure they're deleted after.
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail());
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  testAuth.setUser(null);
  // Attempting to get redirect result. Resolve with empty result (no previous
  // redirect).
  testAuth.assertGetRedirectResult(
      [],
      {
        'user': null,
        'credential': null
      });
  testAuth.process().then(function() {
    // No pending accountchooser.com response which will trigger try select.
    testAc.forceOnEmpty();
    // Confirm accountChooserInvoked is called and run on continue function.
    assertAndRunAccountChooserInvokedCallback();
    // Add account selected logged.
    assertAndRunAccountChooserResultCallback('addAccount');
    // Add account should trigger sign in.
    assertSignInPage();
    // After accountchooser.com redirects and the sign-in page renders, uiShown
    // should be called.
    assertEquals(uiShownCallbackCount, 1);
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    asyncTestCase.signal();
  });
}


function testHandleCallback_nullUser_emailAuthOnly_acDisabled() {
  // Test when no previous sign-in with redirect is detected and the sign-in
  // page is rendered (email auth provider only, credential helpers are
  // disabled).
  app.setConfig({
    'credentialHelper': firebaseui.auth.CredentialHelper.NONE,
    'signInOptions': [firebase.auth.EmailAuthProvider.PROVIDER_ID],
    'callbacks': {
      'accountChooserResult': accountChooserResultCallback,
      'accountChooserInvoked': accountChooserInvokedCallback,
      'uiShown': uiShownCallback
    }
  });
  asyncTestCase.waitForSignals(1);
  // Set some pending email to ensure they're deleted after.
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail());
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  testAuth.setUser(null);
  // Attempting to get redirect result. Resolve with empty result (no previous
  // redirect).
  testAuth.assertGetRedirectResult(
      [],
      {
        'user': null,
        'credential': null
      });
  testAuth.process().then(function() {
    // Confirm accountChooserInvoked is called and run on continue function.
    assertAndRunAccountChooserInvokedCallback();
    // accountchooser.com unavailable logged.
    assertAndRunAccountChooserResultCallback('unavailable');
    // Redirect to the sign-in page with no error message.
    assertSignInPage();
    // No redirect, no uiShown callback.
    assertEquals(uiShownCallbackCount, 0);
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    asyncTestCase.signal();
  });
}


function testHandleCallback_nullUser_emailAuthOnly_acUnavailable() {
  // Test when no previous sign-in with redirect is detected and the sign-in
  // page is rendered (email auth provider only, accountchooser.com is
  // unavailable).
  app.setConfig({
    'credentialHelper': firebaseui.auth.CredentialHelper.ACCOUNT_CHOOSER_COM,
    'signInOptions': [firebase.auth.EmailAuthProvider.PROVIDER_ID],
    'callbacks': {
      'accountChooserResult': accountChooserResultCallback,
      'accountChooserInvoked': accountChooserInvokedCallback,
      'uiShown': uiShownCallback
    }
  });
  // Simulate accountchooser.com not available (browsers that do not support
  // it).
  testAc.setSkipSelect(true);
  testAc.setAvailability(false);
  asyncTestCase.waitForSignals(1);
  // Set some pending email to ensure they're deleted after.
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail());
  firebaseui.auth.storage.setPendingEmailCredential(
      pendingEmailCred, app.getAppId());
  // Callback rendered.
  firebaseui.auth.widget.handler.handleCallback(app, container);
  assertCallbackPage();
  testAuth.setUser(null);
  // Attempting to get redirect result. Resolve with empty result (no previous
  // redirect).
  testAuth.assertGetRedirectResult(
      [],
      {
        'user': null,
        'credential': null
      });
  testAuth.process().then(function() {
    // Confirm accountChooserInvoked is called and run on continue function.
    assertAndRunAccountChooserInvokedCallback();
    // accountchooser.com unavailable logged.
    assertAndRunAccountChooserResultCallback('unavailable');
    // Redirect to the sign-in page with no error message.
    assertSignInPage();
    // No redirect, no uiShown callback.
    assertEquals(uiShownCallbackCount, 0);
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    asyncTestCase.signal();
  });
}

