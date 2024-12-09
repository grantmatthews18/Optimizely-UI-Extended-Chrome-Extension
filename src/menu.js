function log(message) {
    var type = message.type;
    if (type === 'error') {
        console.error('[Menu]', message.content);
    }
    else {
        console.log('[Menu]', message.content);
    }
}

document.addEventListener('DOMContentLoaded', (event) => {
    const checkboxes = document.querySelectorAll('.menu-checkbox');

    var enabledFeatures;
    chrome.storage.local.get(['enabledFeatures'], function (result) {
        //true if authorization exists in session storage

        log({
            type: 'info',
            content: 'Retrieving Enabled Features from Local Storage'
        });



        if (result.enabledFeatures) {
            //found enabled features in session storage
            //this should never be true since this runs once when the extension is installed the session storage is empty
            log({
                type: 'debug',
                content: 'Found Enabled Features in Session Storage'
            });

            //enabling checkboxes based on the enabled features
            document.getElementById('importExportDeleteChanges').checked = result.enabledFeatures.importExportDeleteChanges;
            document.getElementById('transferChanges').checked = result.enabledFeatures.transferChanges;
            document.getElementById('revertChanges').checked = result.enabledFeatures.revertChanges;
            document.getElementById('prioritizeScrape').checked = result.enabledFeatures.prioritizeScrape;

            document.getElementById('copyNames').checked = result.enabledFeatures.copyNames;
            document.getElementById('copyNamesID').checked = result.enabledFeatures.copyNamesID;

            if(!result.enabledFeatures.copyNames){
                document.getElementById('copyNamesID').parentElement.classList.add('disabled');
                document.getElementById('copyNamesID').disabled = true;
            }
            else if(result.enabledFeatures.copyNames){
                document.getElementById('copyNamesID').parentElement.classList.remove('disabled');
                document.getElementById('copyNamesID').disabled = false;
            }

            document.getElementById('logLevel').value = result.enabledFeatures.logLevel;

            enabledFeatures = result.enabledFeatures;

        } else {
            //enabledFeatures not found in local storage
            log({
                type: 'debug',
                content: 'Enabled Features not Found in Local Storage'
            });

            var errorBox = document.getElementById('menu-error-box');
            errorBox.style.display = 'block';
            errorBox.innerHTML = 'Unable to Retrieve Enabled Features from Local Storage';

        }
    });

    checkboxes.forEach((checkbox) => {
        checkbox.addEventListener('click', (event) => {
            enabledFeatures[event.target.id] = event.target.checked;

            if(event.target.id === 'copyNames' && !event.target.checked){
                document.getElementById('copyNamesID').parentElement.classList.add('disabled');
                document.getElementById('copyNamesID').disabled = true;
            }
            else if (event.target.id === 'copyNames' && event.target.checked){
                document.getElementById('copyNamesID').parentElement.classList.remove('disabled');
                document.getElementById('copyNamesID').disabled = false;
            }

            chrome.storage.local.set({ "enabledFeatures": enabledFeatures }, function () {
                log({
                    type: 'info',
                    content: 'Enabled Features Updated in Local Storage'
                });
            });
        });
    });

    document.getElementById('logLevel').addEventListener('change', (event) => {
        enabledFeatures.logLevel = event.target.value;
        chrome.storage.local.set({ "enabledFeatures": enabledFeatures }, function () {
            log({
                type: 'info',
                content: 'Log Level Updated in Local Storage'
            });
        });
    });

    new Promise((resolve, reject) => {
        chrome.storage.local.get(['authorization-user'], function (result) {
            //true if authorization exists in session storage
            if (result['authorization-user']) {
                log({
                    type: 'info',
                    content: 'Found Authorization in Local Storage'
                });
                resolve(true);
            } else {
                log({
                    type: 'info',
                    content: 'Authorization not Found in Local Storage'
                });
                resolve(false);
            }
        });
    }).then((foundAuthorization) => {
        if (foundAuthorization) {
            document.getElementById('tokenState').innerHTML = '[Set]';
            document.getElementById('tokenState').style.color = 'green';
        } else {
            document.getElementById('tokenState').innerHTML = '[Not Set]';
            document.getElementById('tokenState').style.color = 'red';
        }
    });

    document.getElementById('updateTokenButton').addEventListener('click', (event) => {
        const token = 'Bearer ' + document.getElementById('apiToken').value;

        //sending a test request to REST API to see if token is valid
        const options = {
            method: 'GET',
            headers: {
                accept: 'application/json',
                authorization: token
            }
        };

        fetch('https://api.optimizely.com/v2/me', options)
            .then((response) => {
                if (response.status != 200) {
                    document.getElementById('tokenState').innerHTML = '[Invalid]';
                    document.getElementById('tokenState').style.color = 'red';
                    throw new Error('Invalid Token');
                }
                else {
                    chrome.storage.local.set({ "authorizationUser": token }, function () {
                        log({
                            type: 'info',
                            content: 'Token Updated in Local Storage'
                        });
                        document.getElementById('apiToken').value = '';
                        document.getElementById('tokenState').innerHTML = '[Updated]';
                        document.getElementById('tokenState').style.color = 'green';
                    });
                    return true;
                }
            })
            .catch((error) => {
                log({
                    type: 'error',
                    content: 'Invalid Token'
                });
                return false;
            });
    });
});

