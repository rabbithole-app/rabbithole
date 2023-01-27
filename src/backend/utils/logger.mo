import Time "mo:base/Time";
import Int "mo:base/Int";
import List "mo:base/List";

module {
    public type Logger = {
        log : (name : Text) -> Text -> ();
        view : () -> [Text];
        reset : () -> ();
    };
    public class new(size : Nat) {
        var logs : List.List<Text> = List.nil<Text>();

        public func log(name : Text) : Text -> () {
            let prefix = "[" # Int.toText(Time.now()) # "/";
            func(s : Text) : () {
                let message = prefix # Int.toText(Time.now() / 1_000_000_000) # "] " # name # ": " # s;
                if (List.size(logs) >= size) {
                    logs := List.drop(logs, 1);
                };

                logs := List.append<Text>(logs, List.make(message));
            };
        };

        public func view() : [Text] {
            List.toArray(logs);
        };

        public func reset() : () {
            logs := List.nil<Text>();
        };
    };
};
