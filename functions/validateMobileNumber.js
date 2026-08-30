var {parsePhoneNumber, isPossiblePhoneNumber, isValidPhoneNumber, validatePhoneNumberLength} = require('libphonenumber-js')

function checkMobileNumberIsValid(mobile){
    try{
        phoneNumber = parsePhoneNumber(mobile)
        if(phoneNumber){
            if(phoneNumber.isValid() === true){
                if(isValidPhoneNumber(mobile, phoneNumber.country) === true){
                    return true
                }
                return false
            }
            return false
        }
    }catch(e){
        return false
    }
}

module.exports.checkMobileNumberIsValid = checkMobileNumberIsValid;
