// eslint-disable-next-line max-classes-per-file
import React from 'react';
import PropTypes from 'prop-types';
import { SortByKey, HumanSeconds, HumanSize } from '../functions/Functions';

// eslint-disable-next-line react/prefer-stateless-function
export default class StatusPage extends React.Component {
  render() {
    let nodeRows;
    let totalClients = 0;
    const { nodes, nodeCount } = this.props;
    if (nodes.length > 0) {
      nodeRows = [];
      Object.keys(SortByKey(nodes, 'name')).forEach((key) => {
        const node = nodes[key];
        nodeRows.push(<NodeRow node={node} key={node.uid} />);
        totalClients += node.num_clients;
      });
    } else {
      nodeRows = <NodeRowLoader />;
    }

    return (
      <main className="p-3">
        <div className="animated fadeIn">
          <p className="lead">Information about running Centrifugo nodes</p>
          <p className="lead">
            Nodes running:&nbsp;
            {nodeCount}
            , Total clients:&nbsp;
            {totalClients}
          </p>
          <div className="node_info">
            <table className="table table-bordered">
              <thead>
                <tr className="text-center">
                  <th title="Node name">Node name</th>
                  <th title="Node version">Version</th>
                  <th title="Node uptime">Uptime</th>
                  <th title="Total active channels on node">Channels</th>
                  <th title="Total connected clients on node">Clients</th>
                  <th title="Total unique clients on node">Users</th>
                  <th title="Node CPU usage">CPU %</th>
                  <th title="Node RSS memory usage">RSS</th>
                </tr>
              </thead>
              <tbody id="node-info">
                {nodeRows}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    );
  }
}

StatusPage.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  nodes: PropTypes.arrayOf(PropTypes.object).isRequired,
  nodeCount: PropTypes.number.isRequired,
};

// eslint-disable-next-line react/prefer-stateless-function
class NodeRowLoader extends React.Component {
  render() {
    return (
      <tr>
        <td colSpan="6">Waiting for information...</td>
      </tr>
    );
  }
}

// eslint-disable-next-line react/prefer-stateless-function
class NodeRow extends React.Component {
  render() {
    const { node } = this.props;
    const {
      name, version, uptime, num_channels: numChannels,
      num_clients: numClients, num_users: numUsers,
      process,
    } = node;

    return (
      <tr className="text-center">
        <td>{name}</td>
        <td>{version}</td>
        <td>{HumanSeconds(uptime)}</td>
        <td>{numChannels}</td>
        <td>{numClients}</td>
        <td>{numUsers}</td>
        <td>{process ? (process.cpu || 0).toFixed(1) : 'n/a'}</td>
        <td>{process ? HumanSize(process.rss) : 'n/a'}</td>
      </tr>
    );
  }
}

NodeRow.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  node: PropTypes.object.isRequired,
};
