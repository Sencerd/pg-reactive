import Rx from 'rxjs';
import pg from 'pg';
import url from 'url';

export default class pgrx {

  /**
   * Initalize a database connection.
   * @param  {String|Object} config    PostgreSQL database connection string or config object
   * @param  {Object}        [options] Connection options
   */
  constructor(config, options) {
    options = options || {};

    if (options.pool === false) {
      this._db = new pg.Client(config);
      this._type = 'client';
      this._db.connect();
    } else {
      if (typeof config === 'string') {
        let params = url.parse(config);
        let auth = params.auth.split(':');

        config = {
          user: auth[0],
          password: auth[1],
          host: params.hostname,
          port: params.port,
          database: params.pathname.split('/')[1]
        };
      }

      this._db = new pg.Pool(config);
      this._type = 'pool';
    }
  }

  /**
   * Close the current database connection.
   * @return {Undefined}  No return
   */
  end() {
    this._db.end();
  }

  /**
   * Perform quary with optional parameters
   * @param  {String}         sql       Query SQL
   * @param  {Array}          [values]  Optional query parameters
   * @return {Rx.Observable}            Rx.Observable
   */
  query(sql, values) {

    if (!sql || typeof sql !== 'string') {
      throw new Error('Invalid queary: ' + sql);
    }

    if (values) {
      values = Array.isArray(values) ? values : [values];
    }

    if (this._type === 'client') {
      let query = this._db.query(sql, values);

      return Rx.Observable.create((observer) => {
        query.on('row', (row) => { observer.next(row); });
        query.on('error', (error) => { observer.error(error); });
        query.on('end', () => { observer.complete(); });
      });
    } else {
      return Rx.Observable.fromPromise(this._db.connect())
        .mergeMap((client) => {
          let query = client.query(sql, values);

          return Rx.Observable.create((observer) => {
            query.on('row', (row) => { observer.next(row); });
            query.on('error', (error) => {
              client.release();
              observer.error(error);
            });
            query.on('end', () => {
              client.release();
              observer.complete();
            });
          });
        });
    }
  }
}
