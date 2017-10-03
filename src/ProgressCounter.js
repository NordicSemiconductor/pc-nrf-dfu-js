/**
 * Represents an indicator of progress, in number of bytes.
 *
 *
 *
 */

export default class ProgressCounter {

    constructor(targetAmount) {
        this._target = targetAmount;
//         this._startTime = performance.now(); /// TODO: properly use timings
//         this._lastTime = performance.now();
        this._current = 0;

        this._waits = [];
    }

    // Returns a `Promise` that resolves when there has been a
    // progress update, with the progress information at that point.
    // Note that one can `await` for this.
    get nextProgressUpdate() {
        return new Promise((res)=>{
            this._waits.push(()=>{
                res({
                    amount: this._current,
                    percent: this._current / this._target
                });
            });
        });
    }

    // Advances the current progress by the given amount (or reduces it if negative)
    advance(amount){
        this._current += amount;
        this._waits.forEach((f)=>f());
    }

}



