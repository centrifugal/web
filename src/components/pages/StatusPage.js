import React from 'react';
import PropTypes from 'prop-types';
import {SortByKey, HumanSeconds} from '../functions/Functions';

// import react from '../../images/react-small.png';

class StatusPage extends React.Component {
    render() {
        var nodeRows;
        if (this.props.dashboard.nodes.length > 0) {
            nodeRows = [];
            for (var i in SortByKey(this.props.dashboard.nodes, 'name')) {
                var node = this.props.dashboard.nodes[i];
                nodeRows.push(<NodeRow node={node} key={node.uid} />);
            }
        } else {
            nodeRows = <NodeRowLoader />;
        }

        return (
            <main className="p-3">
                <div className="animated fadeIn">
                    <p className="lead">Information about running Centrifugo nodes</p>
                    <p className="lead">Nodes running: {this.props.dashboard.nodeCount}</p>
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

export { StatusPage };

StatusPage.propTypes = {
    dashboard: PropTypes.object
};

class NodeRowLoader extends React.Component {
    render() {
        return (
            <tr>
                <td colSpan="6">Waiting for information...</td>
            </tr>
        );
    }
}

class NodeRow extends React.Component{
    render() {
        return (
            <tr className='text-center'>
                <td>{this.props.node.name}</td>
                <td>{this.props.node.version}</td>
                <td>{HumanSeconds(this.props.node.uptime)}</td>
                <td>{this.props.node.num_channels}</td>
                <td>{this.props.node.num_clients}</td>
                <td>{this.props.node.num_users}</td>
            </tr>
        );
    }
}

NodeRow.propTypes = {
    node: PropTypes.object
};
