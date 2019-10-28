import React from 'react';
import PropTypes from 'prop-types';

const LoadingIndicator = (props) => (
  <div>
    {
            props.busy
            && (
            <div style={{
              top: '50%', left: '50%', textAlign: 'center', color: 'dodgerblue', position: 'absolute', transform: 'translate(-50%, 0)',
            }}
            >
              <i className="fa fa-spinner fa-spin fa-6x fa-fw" />
            </div>
            )
        }
  </div>
);

LoadingIndicator.propTypes = {
  busy: PropTypes.bool,
};

export { LoadingIndicator };
