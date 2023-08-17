import Text "mo:base/Text";
import Blob "mo:base/Blob";
import Nat8 "mo:base/Nat8";
import Nat16 "mo:base/Nat16";

module {
    type ID = Text;
    public type HeaderField = (Text, Text);

    public type HttpRequest = {
        url : Text;
        method : Text;
        body : Blob;
        headers : [HeaderField];
    };

    public type HttpResponse = {
        body : Blob;
        headers : [HeaderField];
        status_code : Nat16;
        streaming_strategy : ?StreamingStrategy;
    };

    public type StreamingStrategy = {
        #Callback : {
            token : StreamingCallbackToken;
            callback : query StreamingCallbackToken -> async StreamingCallbackHttpResponse;
        };
    };

    public type StreamingCallbackToken = {
        id : ID;
        headers : [HeaderField];
        sha256 : ?Blob;
        index : Nat;
    };

    public type StreamingCallbackHttpResponse = {
        body : Blob;
        token : ?StreamingCallbackToken;
    };
};
