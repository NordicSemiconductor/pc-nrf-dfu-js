/**
 * Represents an indicator of progress, in number of bytes.
 *
 *
 *
 */

export default class ProgressCounter {
    constructor(targetAmount) {
        this.target = targetAmount;
        //         this._startTime = performance.now(); /// TODO: properly use timings
        //         this._lastTime = performance.now();
        this.current = 0;

        this.waits = [];
    }

    // Returns a `Promise` that resolves when there has been a
    // progress update, with the progress information at that point.
    // Note that one can `await` for this.
    get nextProgressUpdate() {
        return new Promise(res => {
            this.waits.push(() => {
                res({
                    amount: this.current,
                    percent: this.current / this.target,
                });
            });
        });
    }

    // Advances the current progress by the given amount (or reduces it if negative)
    advance(amount) {
        this.current += amount;
        this.waits.forEach(f => f());
    }
}
